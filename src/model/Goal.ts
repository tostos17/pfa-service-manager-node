import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Match } from './Match';
import { Player } from './Player';

@Entity('goals')
export class Goal {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Match, (match) => match.goalsScored, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'match_id' })
    match!: Match;

    @Column({ name: 'match_time', nullable: false })
    matchTime!: string;

    @ManyToOne(() => Player, { nullable: false, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'scorer_id' })
    scorer!: Player;

    @Column({ name: 'goal_count', type: 'integer', nullable: true })
    count?: number;

    @Column({ name: 'is_freekick', default: false })
    isFreekick!: boolean;

    @Column({ name: 'is_penalty', default: false })
    isPenalty!: boolean;

    @Column({ name: 'is_own_goal', default: false })
    isOwnGoal!: boolean;
}
