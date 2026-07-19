import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Category } from './Category';
import { Player } from './Player';
import { MatchEvent } from './MatchEvent';
import { Goal } from './Goal';
import { Substitution } from './Substitution';
import { MatchPhoto } from './MatchPhoto';
import { MatchVideo } from './MatchVideo';

export enum MatchType {
    FRIENDLY = 'FRIENDLY',
    COMPETITIVE = 'COMPETITIVE'
}

@Entity('matches')
export class Match {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Category, (category) => category.matches, { nullable: true })
    @JoinColumn({ name: 'category_id' })
    category?: Category;

    @Column({ name: 'opponent_name', nullable: false })
    opponentName!: string;

    @Column({ type: 'date', nullable: false })
    date!: string; // 'YYYY-MM-DD'

    @Column({ type: 'time', nullable: false })
    time!: string; // 'HH:MM:SS'

    @Column({ nullable: false })
    venue!: string;

    @Column({ default: false })
    started!: boolean;

    @Column({ name: 'is_live', default: false })
    isLive!: boolean;

    @Column({ default: false })
    ended!: boolean;

    @Column({ name: 'is_home_match', default: false })
    isHomeMatch!: boolean;

    @Column({ name: 'is_away_match', default: false })
    isAwayMatch!: boolean;

    @Column({ name: 'home_team_score', type: 'integer', default: 0 })
    homeTeamScore!: number;

    @Column({ name: 'away_team_score', type: 'integer', default: 0 })
    awayTeamScore!: number;

    @Column({ name: 'match_type', type: 'varchar', nullable: false })
    type!: MatchType;

    @Column({ name: 'half_duration', type: 'integer', default: 45 })
    halfDuration!: number;

    @Column({ name: 'is_extra_time', default: false })
    isExtraTime!: boolean;

    @Column({ name: 'is_penalty_shootout', default: false })
    isPenaltyShootout!: boolean;

    @Column({ name: 'home_team_penalty_score', type: 'integer', default: 0 })
    homeTeamPenaltyScore!: number;

    @Column({ name: 'away_team_penalty_score', type: 'integer', default: 0 })
    awayTeamPenaltyScore!: number;

    @Column({ length: 30, default: 'SCHEDULED' })
    status!: string; // SCHEDULED, FIRST_HALF, HALFTIME, SECOND_HALF, COMPLETED

    @Column({ name: 'current_half_start', type: 'timestamp', nullable: true })
    currentHalfStart?: Date;

    @ManyToMany(() => Player)
    @JoinTable({
        name: 'match_starting_lineup',
        joinColumn: { name: 'match_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'player_id', referencedColumnName: 'id' }
    })
    startingLineup!: Player[];

    @OneToMany(() => MatchEvent, (event) => event.match)
    events!: MatchEvent[];

    @OneToMany(() => Goal, (goal) => goal.match)
    goalsScored!: Goal[];

    @OneToMany(() => Substitution, (sub) => sub.match)
    substitutions!: Substitution[];

    @OneToMany(() => MatchPhoto, (photo) => photo.match)
    photos!: MatchPhoto[];

    @OneToMany(() => MatchVideo, (video) => video.match)
    videos!: MatchVideo[];
}
