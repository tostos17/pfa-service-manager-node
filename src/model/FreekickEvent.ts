import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { MatchEvent } from './MatchEvent';
import { Player } from './Player';

@Entity('events_freekick')
export class FreekickEvent {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @Column({ name: 'dangerous_position', type: 'boolean', default: false })
    dangerousPosition!: boolean;

    @ManyToOne(() => Player, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'taker_id' })
    taker?: Player;

    @Column({ length: 50, nullable: true })
    team?: string;

    @OneToOne(() => MatchEvent, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    matchEvent!: MatchEvent;
}
