import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { Player } from './Player';
import { Category } from './Category';

export enum DominantFoot {
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    AMBIDEXTROUS = 'AMBIDEXTROUS'
}

export enum Position {
    GOALKEEPER = 'GOALKEEPER',
    DEFENDER = 'DEFENDER',
    MIDFIELDER = 'MIDFIELDER',
    FORWARD = 'FORWARD'
}

@Entity('player_profiles')
export class PlayerProfile {
    @PrimaryColumn({ name: 'player_id', type: 'bigint' })
    player_id!: number;

    @Column({ name: 'height_cm', type: 'double precision', nullable: false })
    heightCm!: number;

    @Column({ name: 'weight_kg', type: 'double precision', nullable: false })
    weightKg!: number;

    @Column({ name: 'dominant_foot', type: 'varchar', length: 15, nullable: false })
    dominantFoot!: DominantFoot;

    @Column({ type: 'varchar', length: 30, nullable: false })
    position!: Position;

    @Column({ name: 'preferred_jersey_number', type: 'integer', nullable: true })
    preferredJerseyNumber?: number;

    @Column({ type: 'text', nullable: true })
    biography?: string;

    @OneToOne(() => Player, (player) => player.playerProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'player_id' })
    player!: Player;

    @ManyToOne(() => Category, { nullable: true })
    @JoinColumn({ name: 'category_id' })
    category?: Category;

    @Column({ default: true })
    active!: boolean;
}
