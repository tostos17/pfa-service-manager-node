import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('coaches')
export class Coach {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @Column({ name: 'first_name', length: 50, nullable: false })
    firstName!: string;

    @Column({ name: 'last_name', length: 50, nullable: false })
    lastName!: string;

    @Column({ length: 100, unique: true, nullable: false })
    email!: string;

    @Column({ length: 20, nullable: false })
    phone!: string;

    @Column({ nullable: true })
    specialization?: string;

    @Column({ name: 'employee_id', length: 30, unique: true, nullable: false })
    employeeId!: string;

    @Column({ name: 'license_level', nullable: true })
    licenseLevel?: string;

    @OneToOne(() => User, (user) => user.coach, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    user!: User;
}
