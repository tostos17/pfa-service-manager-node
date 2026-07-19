import { AppDataSource } from '../config/database';
import { Match, MatchType } from '../model/Match';
import { Category } from '../model/Category';
import { Player } from '../model/Player';
import { MatchEvent } from '../model/MatchEvent';
import { MatchStateEvent } from '../model/MatchStateEvent';
import { CardEvent } from '../model/CardEvent';
import { CornerEvent } from '../model/CornerEvent';
import { FreekickEvent } from '../model/FreekickEvent';
import { Goal } from '../model/Goal';
import { Substitution } from '../model/Substitution';
import { MatchPhoto } from '../model/MatchPhoto';
import { MatchVideo } from '../model/MatchVideo';

export class MatchService {
    async createMatch(matchData: any, categoryId?: number) {
        const matchRepository = AppDataSource.getRepository(Match);
        const categoryRepository = AppDataSource.getRepository(Category);

        let match: Match;
        if (matchData.id) {
            match = await matchRepository.findOneOrFail({ where: { id: matchData.id } });
            match.opponentName = matchData.opponentName;
            match.date = matchData.date;
            match.time = matchData.time;
            match.venue = matchData.venue;
            match.isHomeMatch = matchData.isHomeMatch;
            match.isAwayMatch = matchData.isAwayMatch;
            match.type = matchData.type;
            match.halfDuration = matchData.halfDuration;
        } else {
            match = matchRepository.create(matchData as Match);
        }

        if (categoryId) {
            const category = await categoryRepository.findOne({ where: { id: categoryId } });
            if (!category) {
                throw new Error(`Category not found with ID: ${categoryId}`);
            }
            match.category = category;
        } else {
            match.category = undefined;
        }

        return await matchRepository.save(match);
    }

    async getMatchById(id: number) {
        const matchRepository = AppDataSource.getRepository(Match);
        const match = await matchRepository.findOne({
            where: { id },
            relations: ['category', 'photos', 'videos']
        });
        if (!match) {
            throw new Error(`Match data records not found for ID: ${id}`);
        }
        return match;
    }

    async getAllMatches() {
        const matchRepository = AppDataSource.getRepository(Match);
        return await matchRepository.find({ relations: ['category', 'photos', 'videos'] });
    }

    async getLiveMatches() {
        const matchRepository = AppDataSource.getRepository(Match);
        return await matchRepository.find({ where: { isLive: true }, relations: ['category', 'photos', 'videos'] });
    }

    async startMatch(matchId: number) {
        const match = await this.getMatchById(matchId);
        match.started = true;
        match.isLive = true;
        match.status = 'FIRST_HALF';
        match.currentHalfStart = new Date();

        await AppDataSource.transaction(async (transactionManager) => {
            const matchEventRepository = transactionManager.getRepository(MatchEvent);
            const stateEventRepository = transactionManager.getRepository(MatchStateEvent);

            const baseEvent = matchEventRepository.create({
                match,
                matchTime: '0',
                eventType: 'GENERIC'
            });
            const savedBaseEvent = await matchEventRepository.save(baseEvent);

            const stateEvent = stateEventRepository.create({
                id: Number(savedBaseEvent.id),
                stateName: '1ST_HALF_STARTED',
                matchEvent: savedBaseEvent
            });
            await stateEventRepository.save(stateEvent);

            await transactionManager.getRepository(Match).save(match);
        });

        return match;
    }

    async updateStartingLineup(matchId: number, playerIds: number[]) {
        const match = await this.getMatchById(matchId);
        const players: Player[] = [];
        const playerRepository = AppDataSource.getRepository(Player);

        for (const pid of playerIds) {
            const player = await playerRepository.findOne({ where: { id: pid } });
            if (player) {
                players.push(player);
            }
        }

        match.startingLineup = players;
        return await AppDataSource.getRepository(Match).save(match);
    }

    async recordGoal(matchId: number, goalData: any, scorerPlayerId: number) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive) {
            throw new Error('Cannot record goal. Match is not live.');
        }

        const scorer = await AppDataSource.getRepository(Player).findOne({ where: { id: scorerPlayerId } });
        if (!scorer) {
            throw new Error(`Player not found with ID: ${scorerPlayerId}`);
        }

        await AppDataSource.transaction(async (transactionManager) => {
            const goalRepository = transactionManager.getRepository(Goal);

            const goal = goalRepository.create({
                match,
                scorer,
                matchTime: goalData.matchTime,
                count: goalData.count,
                isFreekick: goalData.isFreekick === true || goalData.isFreekick === 'true',
                isPenalty: goalData.isPenalty === true || goalData.isPenalty === 'true',
                isOwnGoal: goalData.isOwnGoal === true || goalData.isOwnGoal === 'true'
            });

            if (match.isHomeMatch) {
                if (!goal.isOwnGoal) {
                    match.homeTeamScore += 1;
                } else {
                    match.awayTeamScore += 1;
                }
            } else {
                if (!goal.isOwnGoal) {
                    match.awayTeamScore += 1;
                } else {
                    match.homeTeamScore += 1;
                }
            }

            await goalRepository.save(goal);
            await transactionManager.getRepository(Match).save(match);
        });
    }

    async recordSubstitution(matchId: number, subData: any, playerInId: number, playerOutId: number) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive) {
            throw new Error('Cannot record substitution. Match is not live.');
        }

        const playerIn = await AppDataSource.getRepository(Player).findOne({ where: { id: playerInId } });
        const playerOut = await AppDataSource.getRepository(Player).findOne({ where: { id: playerOutId } });

        if (!playerIn || !playerOut) {
            throw new Error('Incoming or Outgoing player not found.');
        }

        await AppDataSource.transaction(async (transactionManager) => {
            const subRepository = transactionManager.getRepository(Substitution);
            const sub = subRepository.create({
                match,
                matchTime: subData.matchTime,
                playerIn,
                playerOut
            });
            await subRepository.save(sub);
        });
    }

    async recordGenericEvent(matchId: number, eventData: any) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive) {
            throw new Error('Cannot record event. Match is not live.');
        }

        await AppDataSource.transaction(async (transactionManager) => {
            const matchEventRepository = transactionManager.getRepository(MatchEvent);
            const baseEvent = matchEventRepository.create({
                match,
                matchTime: eventData.matchTime,
                eventType: 'GENERIC'
            });
            const savedBaseEvent = await matchEventRepository.save(baseEvent);

            const stateEventRepository = transactionManager.getRepository(MatchStateEvent);
            const stateEvent = stateEventRepository.create({
                id: Number(savedBaseEvent.id),
                stateName: eventData.stateName || 'GENERIC_EVENT',
                matchEvent: savedBaseEvent
            });
            await stateEventRepository.save(stateEvent);
        });
    }

    async endMatch(matchId: number) {
        const match = await this.getMatchById(matchId);

        if (match.type === MatchType.COMPETITIVE && match.homeTeamScore === match.awayTeamScore) {
            if (!match.isExtraTime && !match.isPenaltyShootout) {
                match.isExtraTime = true;
                await AppDataSource.transaction(async (transactionManager) => {
                    const matchEventRepository = transactionManager.getRepository(MatchEvent);
                    const stateEventRepository = transactionManager.getRepository(MatchStateEvent);

                    const baseEvent = matchEventRepository.create({ match, matchTime: '90', eventType: 'GENERIC' });
                    const savedBaseEvent = await matchEventRepository.save(baseEvent);

                    const etEvent = stateEventRepository.create({
                        id: Number(savedBaseEvent.id),
                        stateName: 'EXTRA_TIME_STARTED',
                        matchEvent: savedBaseEvent
                    });
                    await stateEventRepository.save(etEvent);
                    await transactionManager.getRepository(Match).save(match);
                });
                return match;
            }

            if (match.isExtraTime && !match.isPenaltyShootout) {
                match.isExtraTime = false;
                match.isPenaltyShootout = true;
                await AppDataSource.transaction(async (transactionManager) => {
                    const matchEventRepository = transactionManager.getRepository(MatchEvent);
                    const stateEventRepository = transactionManager.getRepository(MatchStateEvent);

                    const baseEvent = matchEventRepository.create({ match, matchTime: '120', eventType: 'GENERIC' });
                    const savedBaseEvent = await matchEventRepository.save(baseEvent);

                    const penEvent = stateEventRepository.create({
                        id: Number(savedBaseEvent.id),
                        stateName: 'PENALTY_SHOOTOUT_STARTED',
                        matchEvent: savedBaseEvent
                    });
                    await stateEventRepository.save(penEvent);
                    await transactionManager.getRepository(Match).save(match);
                });
                return match;
            }
        }

        match.isLive = false;
        match.ended = true;
        match.isExtraTime = false;
        match.isPenaltyShootout = false;
        match.status = 'COMPLETED';
        match.currentHalfStart = undefined;

        await AppDataSource.transaction(async (transactionManager) => {
            const matchEventRepository = transactionManager.getRepository(MatchEvent);
            const stateEventRepository = transactionManager.getRepository(MatchStateEvent);

            const baseEvent = matchEventRepository.create({
                match,
                matchTime: match.isPenaltyShootout ? 'PEN' : 'FT',
                eventType: 'GENERIC'
            });
            const savedBaseEvent = await matchEventRepository.save(baseEvent);

            const endEvent = stateEventRepository.create({
                id: Number(savedBaseEvent.id),
                stateName: 'MATCH_CONCLUDED',
                matchEvent: savedBaseEvent
            });
            await stateEventRepository.save(endEvent);
            await transactionManager.getRepository(Match).save(match);
        });

        return match;
    }

    async recordPenaltyScore(matchId: number, homePenalties: number, awayPenalties: number) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive) {
            throw new Error('Cannot record penalty score. Match is not live.');
        }
        if (!match.isPenaltyShootout) {
            throw new Error('Cannot log shootout tallies unless match status is explicitly set to penalty shootout.');
        }
        match.homeTeamPenaltyScore = homePenalties;
        match.awayTeamPenaltyScore = awayPenalties;
        return await AppDataSource.getRepository(Match).save(match);
    }

    async getMatchTimeline(matchId: number) {
        const match = await AppDataSource.getRepository(Match).findOneOrFail({
            where: { id: matchId },
            relations: ['goalsScored', 'goalsScored.scorer', 'substitutions', 'substitutions.playerIn', 'substitutions.playerOut']
        });

        const timeline: any[] = [];

        if (match.goalsScored) {
            for (const goal of match.goalsScored) {
                const scorerName = goal.scorer ? `${goal.scorer.firstName} ${goal.scorer.lastName}` : 'Unknown';
                const desc = (goal.isOwnGoal ? 'Own Goal' : goal.isPenalty ? 'Penalty Goal' : goal.isFreekick ? 'Freekick Goal' : 'Goal')
                    + ` scored by ${scorerName}`;

                timeline.push({
                    type: 'GOAL',
                    matchTime: goal.matchTime,
                    description: desc,
                    primaryPlayerId: goal.scorer ? Number(goal.scorer.id) : null,
                    primaryPlayerName: scorerName
                });
            }
        }

        if (match.substitutions) {
            for (const sub of match.substitutions) {
                const pInName = sub.playerIn ? `${sub.playerIn.firstName} ${sub.playerIn.lastName}` : 'Unknown';
                const pOutName = sub.playerOut ? `${sub.playerOut.firstName} ${sub.playerOut.lastName}` : 'Unknown';
                const desc = `Substitution: In - ${pInName}, Out - ${pOutName}`;

                timeline.push({
                    type: 'SUBSTITUTION',
                    matchTime: sub.matchTime,
                    description: desc,
                    primaryPlayerId: sub.playerIn ? Number(sub.playerIn.id) : null,
                    primaryPlayerName: pInName,
                    secondaryPlayerId: sub.playerOut ? Number(sub.playerOut.id) : null,
                    secondaryPlayerName: pOutName
                });
            }
        }

        const stateEvents = await AppDataSource.getRepository(MatchStateEvent).find({
            where: { matchEvent: { match: { id: matchId } } },
            relations: ['matchEvent']
        });
        for (const se of stateEvents) {
            timeline.push({
                type: 'STATE_CHANGE',
                matchTime: se.matchEvent.matchTime,
                description: se.stateName,
                primaryPlayerId: null,
                primaryPlayerName: null
            });
        }

        const cardEvents = await AppDataSource.getRepository(CardEvent).find({
            where: { matchEvent: { match: { id: matchId } } },
            relations: ['matchEvent', 'player']
        });
        for (const ce of cardEvents) {
            const type = `CARD_${ce.cardType.toUpperCase()}`;
            const cardName = ce.cardType.toUpperCase() === 'YELLOW' ? 'Yellow Card' : 'Red Card';
            const teamName = ce.team.toUpperCase() === 'HOME' ? 'PFA Academy' : 'Opponent';
            let desc = '';
            let pName = 'Unknown';
            if (ce.player) {
                pName = `${ce.player.firstName} ${ce.player.lastName}`;
                desc = `${cardName} issued to ${pName} (${teamName})`;
            } else {
                desc = `${cardName} issued to ${teamName} player`;
            }

            timeline.push({
                type,
                matchTime: ce.matchEvent.matchTime,
                description: desc,
                primaryPlayerId: ce.player ? Number(ce.player.id) : null,
                primaryPlayerName: pName
            });
        }

        const cornerEvents = await AppDataSource.getRepository(CornerEvent).find({
            where: { matchEvent: { match: { id: matchId } } },
            relations: ['matchEvent']
        });
        for (const co of cornerEvents) {
            const teamName = co.team.toUpperCase() === 'HOME' ? 'PFA Academy' : 'Opponent';
            timeline.push({
                type: 'CORNER',
                matchTime: co.matchEvent.matchTime,
                description: `Corner kick for ${teamName}`,
                primaryPlayerId: null,
                primaryPlayerName: null
            });
        }

        const freekickEvents = await AppDataSource.getRepository(FreekickEvent).find({
            where: { matchEvent: { match: { id: matchId } } },
            relations: ['matchEvent', 'taker']
        });
        for (const fk of freekickEvents) {
            const teamName = fk.team && fk.team.toUpperCase() === 'HOME' ? 'PFA Academy' : 'Opponent';
            let desc = '';
            let pName = '';
            if (fk.taker) {
                pName = `${fk.taker.firstName} ${fk.taker.lastName}`;
                desc = `Freekick for ${teamName} taken by ${pName}`;
            } else {
                desc = `Freekick for ${teamName}`;
            }

            timeline.push({
                type: 'FREEKICK',
                matchTime: fk.matchEvent.matchTime,
                description: desc,
                primaryPlayerId: fk.taker ? Number(fk.taker.id) : null,
                primaryPlayerName: pName || null
            });
        }

        timeline.sort((e1, e2) => this.compareMatchTime(e1.matchTime, e2.matchTime));

        return {
            matchId,
            timeline
        };
    }

    async getMatchLineupDetails(matchId: number) {
        const match = await AppDataSource.getRepository(Match).findOneOrFail({
            where: { id: matchId },
            relations: ['startingLineup', 'startingLineup.playerProfile']
        });

        return match.startingLineup.map((player) => {
            const profile = player.playerProfile;
            return {
                id: Number(player.id),
                playerId: player.playerId,
                firstName: player.firstName,
                lastName: player.lastName,
                position: profile ? profile.position : null,
                jerseyNumber: profile ? profile.preferredJerseyNumber : null,
                photoUrl: player.passportUrl || null
            };
        });
    }

    async updateMatchScore(matchId: number, homeTeamScore: number, awayTeamScore: number) {
        const match = await this.getMatchById(matchId);
        match.homeTeamScore = homeTeamScore;
        match.awayTeamScore = awayTeamScore;
        return await AppDataSource.getRepository(Match).save(match);
    }

    async updateHalfDuration(id: number, duration: number) {
        const match = await this.getMatchById(id);
        if (match.started) {
            throw new Error('Cannot change half duration after match kickoff.');
        }
        match.halfDuration = duration;
        return await AppDataSource.getRepository(Match).save(match);
    }

    async transitionToHalftime(matchId: number) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive || match.status !== 'FIRST_HALF') {
            throw new Error('Cannot transition to halftime. Match is not in 1st half.');
        }
        match.status = 'HALFTIME';
        match.currentHalfStart = undefined;

        await AppDataSource.transaction(async (transactionManager) => {
            const matchEventRepository = transactionManager.getRepository(MatchEvent);
            const stateEventRepository = transactionManager.getRepository(MatchStateEvent);

            const baseEvent = matchEventRepository.create({
                match,
                matchTime: String(match.halfDuration),
                eventType: 'GENERIC'
            });
            const savedBaseEvent = await matchEventRepository.save(baseEvent);

            const stateEvent = stateEventRepository.create({
                id: Number(savedBaseEvent.id),
                stateName: 'HALFTIME',
                matchEvent: savedBaseEvent
            });
            await stateEventRepository.save(stateEvent);
            await transactionManager.getRepository(Match).save(match);
        });

        return match;
    }

    async startSecondHalf(matchId: number) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive || match.status !== 'HALFTIME') {
            throw new Error('Cannot start 2nd half. Match is not in halftime.');
        }
        match.status = 'SECOND_HALF';
        match.currentHalfStart = new Date();

        await AppDataSource.transaction(async (transactionManager) => {
            const matchEventRepository = transactionManager.getRepository(MatchEvent);
            const stateEventRepository = transactionManager.getRepository(MatchStateEvent);

            const baseEvent = matchEventRepository.create({
                match,
                matchTime: String(match.halfDuration),
                eventType: 'GENERIC'
            });
            const savedBaseEvent = await matchEventRepository.save(baseEvent);

            const stateEvent = stateEventRepository.create({
                id: Number(savedBaseEvent.id),
                stateName: '2ND_HALF_STARTED',
                matchEvent: savedBaseEvent
            });
            await stateEventRepository.save(stateEvent);
            await transactionManager.getRepository(Match).save(match);
        });

        return match;
    }

    async recordCard(matchId: number, cardType: string, playerId: number | undefined, team: string, matchTime: string) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive) {
            throw new Error('Cannot record card. Match is not live.');
        }

        await AppDataSource.transaction(async (transactionManager) => {
            const matchEventRepository = transactionManager.getRepository(MatchEvent);
            const cardEventRepository = transactionManager.getRepository(CardEvent);

            const baseEvent = matchEventRepository.create({
                match,
                matchTime,
                eventType: 'CARD'
            });
            const savedBaseEvent = await matchEventRepository.save(baseEvent);

            let player;
            if (playerId) {
                player = await transactionManager.getRepository(Player).findOne({ where: { id: playerId } });
                if (!player) {
                    throw new Error(`Player not found with ID: ${playerId}`);
                }
            }

            const cardEvent = cardEventRepository.create({
                id: Number(savedBaseEvent.id),
                cardType,
                team,
                player,
                matchEvent: savedBaseEvent
            });
            await cardEventRepository.save(cardEvent);
        });
    }

    async recordCorner(matchId: number, team: string, matchTime: string) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive) {
            throw new Error('Cannot record corner. Match is not live.');
        }

        await AppDataSource.transaction(async (transactionManager) => {
            const matchEventRepository = transactionManager.getRepository(MatchEvent);
            const cornerEventRepository = transactionManager.getRepository(CornerEvent);

            const baseEvent = matchEventRepository.create({
                match,
                matchTime,
                eventType: 'CORNER'
            });
            const savedBaseEvent = await matchEventRepository.save(baseEvent);

            const cornerEvent = cornerEventRepository.create({
                id: Number(savedBaseEvent.id),
                team,
                matchEvent: savedBaseEvent
            });
            await cornerEventRepository.save(cornerEvent);
        });
    }

    async recordFreekick(matchId: number, team: string, matchTime: string, takerPlayerId?: number) {
        const match = await this.getMatchById(matchId);
        if (!match.isLive) {
            throw new Error('Cannot record freekick. Match is not live.');
        }

        await AppDataSource.transaction(async (transactionManager) => {
            const matchEventRepository = transactionManager.getRepository(MatchEvent);
            const freekickEventRepository = transactionManager.getRepository(FreekickEvent);

            const baseEvent = matchEventRepository.create({
                match,
                matchTime,
                eventType: 'FREEKICK'
            });
            const savedBaseEvent = await matchEventRepository.save(baseEvent);

            let taker;
            if (takerPlayerId) {
                taker = await transactionManager.getRepository(Player).findOne({ where: { id: takerPlayerId } });
                if (!taker) {
                    throw new Error(`Taker player not found with ID: ${takerPlayerId}`);
                }
            }

            const fkEvent = freekickEventRepository.create({
                id: Number(savedBaseEvent.id),
                dangerousPosition: false,
                team,
                taker,
                matchEvent: savedBaseEvent
            });
            await freekickEventRepository.save(fkEvent);
        });
    }

    private compareMatchTime(t1: string, t2: string): number {
        if (!t1) return !t2 ? 0 : -1;
        if (!t2) return 1;
        if (t1 === t2) return 0;

        const t1Final = t1.toUpperCase() === 'FT' || t1.toUpperCase() === 'PEN';
        const t2Final = t2.toUpperCase() === 'FT' || t2.toUpperCase() === 'PEN';
        if (t1Final && !t2Final) return 1;
        if (!t1Final && t2Final) return -1;
        if (t1Final && t2Final) return t1.localeCompare(t2);

        try {
            const val1 = this.parseMinutes(t1);
            const val2 = this.parseMinutes(t2);
            if (val1 !== val2) {
                return val1 - val2;
            }
            return this.parseStoppage(t1) - this.parseStoppage(t2);
        } catch (e) {
            return t1.localeCompare(t2);
        }
    }

    private parseMinutes(time: string): number {
        const base = time.split('+')[0];
        return parseInt(base.replace(/[^0-9]/g, ''));
    }

    private parseStoppage(time: string): number {
        if (!time.includes('+')) return 0;
        const stoppage = time.split('+')[1];
        return parseInt(stoppage.replace(/[^0-9]/g, ''));
    }
}

export const matchService = new MatchService();
