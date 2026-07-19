import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Match } from './Match';
import { Player } from './Player';

@Entity('substitutions')
export class Substitution {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Match, (match) => match.substitutions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'match_id' })
    match!: Match;

    @Column({ name: 'match_time', nullable: false })
    matchTime!: string;

    @ManyToOne(() => Player, { nullable: false, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'player_in_id' })
    playerIn!: Player;

    @ManyToOne(() => Player, { nullable: false, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'player_out_id' })
    playerOut!: Player;
}
