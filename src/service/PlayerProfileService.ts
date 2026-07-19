import { AppDataSource } from '../config/database';
import { Player } from '../model/Player';
import { PlayerProfile, DominantFoot, Position } from '../model/PlayerProfile';
import { Category } from '../model/Category';
import { Match } from '../model/Match';
import { Goal } from '../model/Goal';
import { AgeCalculator } from '../utils/AgeCalculator';

export class PlayerProfileService {
    async createOrUpdateProfile(playerId: string, request: any) {
        const playerRepository = AppDataSource.getRepository(Player);
        const profileRepository = AppDataSource.getRepository(PlayerProfile);

        const player = await playerRepository.findOne({ where: { playerId } });
        if (!player) {
            throw new Error(`Player not found with ID: ${playerId}`);
        }

        let profile = await profileRepository.findOne({
            where: { player: { playerId } },
            relations: ['player', 'category']
        });

        if (!profile) {
            profile = profileRepository.create();
            profile.player_id = Number(player.id);
            profile.player = player;
        }

        profile.heightCm = parseFloat(request.heightCm || '0');
        profile.weightKg = parseFloat(request.weightKg || '0');
        profile.dominantFoot = (request.dominantFoot || 'RIGHT').toUpperCase() as DominantFoot;
        profile.position = (request.position || 'FORWARD').toUpperCase() as Position;
        profile.preferredJerseyNumber = request.preferredJerseyNumber ? parseInt(request.preferredJerseyNumber) : undefined;
        profile.biography = request.biography;

        await profileRepository.save(profile);
        return this.mapToResponse(profile);
    }

    async getProfileByPlayerId(playerId: string) {
        const profileRepository = AppDataSource.getRepository(PlayerProfile);
        const profile = await profileRepository.findOne({
            where: { player: { playerId } },
            relations: ['player', 'player.parent', 'category']
        });

        if (!profile) {
            throw new Error(`Metrics profile not initialized yet for player ID: ${playerId}`);
        }
        return this.mapToResponse(profile);
    }

    async updateSquadNumber(request: any) {
        const profileRepository = AppDataSource.getRepository(PlayerProfile);
        const profile = await profileRepository.findOne({
            where: { player: { playerId: request.playerId } }
        });
        if (!profile) {
            throw new Error('Player not found');
        }
        profile.preferredJerseyNumber = parseInt(request.number);
        await profileRepository.save(profile);
        return 'Squad number updated';
    }

    async updatePlayerHeight(request: any) {
        const profileRepository = AppDataSource.getRepository(PlayerProfile);
        const profile = await profileRepository.findOne({
            where: { player: { playerId: request.playerId } }
        });
        if (!profile) {
            throw new Error('Player not found');
        }
        profile.heightCm = parseFloat(request.measurement);
        await profileRepository.save(profile);
        return 'Height updated Successfully';
    }

    async updatePlayerWeight(request: any) {
        const profileRepository = AppDataSource.getRepository(PlayerProfile);
        const profile = await profileRepository.findOne({
            where: { player: { playerId: request.playerId } }
        });
        if (!profile) {
            throw new Error('Player not found');
        }
        profile.weightKg = parseFloat(request.measurement);
        await profileRepository.save(profile);
        return 'Weight updated Successfully';
    }

    async updatePlayerPosition(request: any) {
        const profileRepository = AppDataSource.getRepository(PlayerProfile);
        const profile = await profileRepository.findOne({
            where: { player: { playerId: request.playerId } }
        });
        if (!profile) {
            throw new Error('Player not found');
        }
        profile.position = request.position.toUpperCase() as Position;
        await profileRepository.save(profile);
        return 'Position updated Successfully';
    }

    async updateDominantFoot(request: any) {
        const profileRepository = AppDataSource.getRepository(PlayerProfile);
        const profile = await profileRepository.findOne({
            where: { player: { playerId: request.playerId } }
        });
        if (!profile) {
            throw new Error('Player not found');
        }
        profile.dominantFoot = request.dominantFoot.toUpperCase() as DominantFoot;
        await profileRepository.save(profile);
        return 'Dominant foot updated Successfully';
    }

    async updatePlayerCategory(request: any) {
        const profileRepository = AppDataSource.getRepository(PlayerProfile);
        const categoryRepository = AppDataSource.getRepository(Category);

        const profile = await profileRepository.findOne({
            where: { player: { playerId: request.playerId } }
        });
        if (!profile) {
            throw new Error('Player not found');
        }

        if (request.categoryId) {
            const category = await categoryRepository.findOne({ where: { id: parseInt(request.categoryId) } });
            if (!category) {
                throw new Error(`Category not found with ID: ${request.categoryId}`);
            }
            profile.category = category;
        } else {
            profile.category = undefined;
        }

        await profileRepository.save(profile);
        return 'Player category updated Successfully';
    }

    async getAllPlayerProfiles(search: string | undefined, pageNumber: number = 0, pageSize: number = 10) {
        const profileRepository = AppDataSource.getRepository(PlayerProfile);
        const queryBuilder = profileRepository
            .createQueryBuilder('profile')
            .leftJoinAndSelect('profile.player', 'player')
            .leftJoinAndSelect('player.parent', 'parent')
            .leftJoinAndSelect('profile.category', 'category');

        if (search && search.trim() !== '') {
            queryBuilder.where('LOWER(category.name) LIKE :search', { search: `%${search.toLowerCase()}%` });
        }

        queryBuilder
            .skip(pageNumber * pageSize)
            .take(pageSize);

        const [profiles, total] = await queryBuilder.getManyAndCount();

        const content = profiles.map((p) => this.mapToResponse(p));
        return {
            content,
            pageable: {
                pageNumber,
                pageSize
            },
            totalElements: total,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    async getPlayerStats(playerId: string) {
        const playerRepository = AppDataSource.getRepository(Player);
        const player = await playerRepository.findOne({ where: { playerId } });
        if (!player) {
            throw new Error(`Player not found with ID: ${playerId}`);
        }

        const matches = await AppDataSource.getRepository(Match)
            .createQueryBuilder('match')
            .leftJoinAndSelect('match.startingLineup', 'startingLineup')
            .leftJoinAndSelect('match.substitutions', 'substitutions')
            .leftJoinAndSelect('substitutions.playerIn', 'playerIn')
            .where('startingLineup.playerId = :playerId', { playerId })
            .orWhere('playerIn.playerId = :playerId', { playerId })
            .getMany();

        const caps = matches.map((match) => {
            const isStarter = match.startingLineup.some((p) => p.playerId === playerId);
            return {
                matchId: Number(match.id),
                opponentName: match.opponentName,
                date: match.date,
                matchType: match.type,
                status: isStarter ? 'STARTING_LINEUP' : 'SUBSTITUTE'
            };
        });

        const goalsList = await AppDataSource.getRepository(Goal)
            .createQueryBuilder('goal')
            .leftJoinAndSelect('goal.scorer', 'scorer')
            .leftJoinAndSelect('goal.match', 'match')
            .where('scorer.playerId = :playerId', { playerId })
            .andWhere('goal.isOwnGoal = false')
            .getMany();

        const goals = goalsList.map((goal) => ({
            goalId: Number(goal.id),
            matchId: Number(goal.match.id),
            opponentName: goal.match.opponentName,
            matchTime: goal.matchTime,
            isPenalty: goal.isPenalty,
            isFreekick: goal.isFreekick
        }));

        return {
            totalCaps: caps.length,
            totalGoals: goals.length,
            caps,
            goals
        };
    }

    private mapToResponse(profile: PlayerProfile) {
        const player = profile.player;
        const middleInitial = player.middleName ? `${player.middleName.substring(0, 1).toUpperCase()}. ` : '';
        const displayName = `${player.firstName} ${middleInitial}${player.lastName}`;

        return {
            playerId: player.playerId,
            playerName: displayName,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            dominantFoot: profile.dominantFoot,
            position: profile.position,
            preferredJerseyNumber: profile.preferredJerseyNumber,
            biography: profile.biography,
            photo: player.passportUrl || null,
            age: AgeCalculator.getAgeInYearsAndDays(player.dateOfBirth),
            parentPhone: player.parent ? player.parent.phone : 'N/A',
            category: profile.category ? profile.category.name : 'GENERAL',
            id: Number(player.id),
            status: player.status || 'ACTIVE'
        };
    }
}

export const playerProfileService = new PlayerProfileService();
