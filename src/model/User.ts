import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToOne } from 'typeorm';
import { Role } from './Role';
import { Parent } from './Parent';
import { Coach } from './Coach';
import { Player } from './Player';
import { Admin } from './Admin';
import { Director } from './Director';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ unique: true, nullable: false })
    username!: string;

    @Column({ nullable: false })
    password!: string;

    @Column({ default: true })
    enabled!: boolean;

    @Column({ name: 'require_password_change', default: true })
    requirePasswordChange!: boolean;

    @ManyToMany(() => Role)
    @JoinTable({
        name: 'user_roles',
        joinColumn: { name: 'user_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' }
    })
    roles!: Role[];

    @OneToOne(() => Parent, (parent) => parent.user, { cascade: true })
    parent?: Parent;

    @OneToOne(() => Coach, (coach) => coach.user, { cascade: true })
    coach?: Coach;

    @OneToOne(() => Player, (player) => player.user, { cascade: true })
    player?: Player;

    @OneToOne(() => Admin, (admin) => admin.user, { cascade: true })
    admin?: Admin;

    @OneToOne(() => Director, (director) => director.user, { cascade: true })
    director?: Director;
}
