import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { MatchEvent } from './MatchEvent';

@Entity('events_corner')
export class CornerEvent {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @Column({ length: 50, nullable: false })
    team!: string; // HOME, AWAY

    @OneToOne(() => MatchEvent, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    matchEvent!: MatchEvent;
}
