import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('admins')
export class Admin {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @Column({ name: 'first_name', length: 50, nullable: false })
    firstName!: string;

    @Column({ name: 'last_name', length: 50, nullable: false })
    lastName!: string;

    @Column({ length: 100, unique: true, nullable: false })
    email!: string;

    @Column({ name: 'employee_id', length: 30, unique: true, nullable: false })
    employeeId!: string;

    @OneToOne(() => User, (user) => user.admin, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    user!: User;
}
