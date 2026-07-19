import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Match } from './Match';

@Entity('match_events')
export class MatchEvent {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Match, (match) => match.events, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'match_id' })
    match!: Match;

    @Column({ name: 'match_time', nullable: false })
    matchTime!: string;

    @Column({ name: 'event_type', nullable: false })
    eventType!: string; // 'GENERIC', 'FREEKICK', 'CARD', 'CORNER'
}
