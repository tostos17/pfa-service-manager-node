import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { MatchEvent } from './MatchEvent';

@Entity('events_generic')
export class MatchStateEvent {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @Column({ name: 'state_name', nullable: false })
    stateName!: string;

    @OneToOne(() => MatchEvent, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    matchEvent!: MatchEvent;
}
