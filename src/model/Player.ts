import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { User } from './User';
import { Parent } from './Parent';
import { PlayerProfile } from './PlayerProfile';
import { Account } from './Account';

@Entity('players')
export class Player {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @Column({ name: 'player_id', nullable: false })
    playerId!: string;

    @Column({ name: 'first_name', length: 50, nullable: false })
    firstName!: string;

    @Column({ name: 'middle_name', length: 50, nullable: false })
    middleName!: string;

    @Column({ name: 'last_name', length: 50, nullable: false })
    lastName!: string;

    @Column({ length: 100, unique: true, nullable: true })
    email?: string;

    @Column({ name: 'phone_number', nullable: true })
    phone?: string;

    @Column({ name: 'date_of_birth', type: 'date', nullable: false })
    dateOfBirth!: string; // Using string 'YYYY-MM-DD' for date representation

    @Column({ length: 100, nullable: true })
    address?: string;

    @Column({ name: 'state_of_origin', nullable: true })
    stateOfOrigin?: string;

    @Column({ nullable: true })
    country?: string;

    @Column({ default: true })
    healthy!: boolean;

    @Column({ name: 'health_concerns', nullable: true })
    healthConcernDescription?: string;

    @Column({ name: 'passport_url', length: 500, nullable: true })
    passportUrl?: string;

    @ManyToOne(() => Parent, { nullable: true })
    @JoinColumn({ name: 'parent_id' })
    parent?: Parent;

    @OneToOne(() => User, (user) => user.player, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    user!: User;

    @OneToOne(() => PlayerProfile, (profile) => profile.player, { cascade: true })
    playerProfile?: PlayerProfile;

    @OneToOne(() => Account, (account) => account.player, { cascade: true })
    account?: Account;

    @Column({ length: 30, default: 'ACTIVE' })
    status!: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

    @Column({ name: 'registration_date', type: 'date', nullable: false })
    registrationDate!: string;
}
