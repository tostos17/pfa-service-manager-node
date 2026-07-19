import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { MatchEvent } from './MatchEvent';
import { Player } from './Player';

@Entity('events_card')
export class CardEvent {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Player, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'player_id' })
    player?: Player;

    @Column({ name: 'card_type', length: 50, nullable: false })
    cardType!: string; // YELLOW, RED

    @Column({ length: 50, nullable: false })
    team!: string; // HOME, AWAY

    @OneToOne(() => MatchEvent, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    matchEvent!: MatchEvent;
}
