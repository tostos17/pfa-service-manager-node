import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { PlayerProfile } from './PlayerProfile';
import { Match } from './Match';

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ unique: true, nullable: false })
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @OneToMany(() => PlayerProfile, (profile) => profile.category)
    playerProfiles!: PlayerProfile[];

    @OneToMany(() => Match, (match) => match.category)
    matches!: Match[];
}
