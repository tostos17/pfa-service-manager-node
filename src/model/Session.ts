import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Term } from './Term';

@Entity('sessions')
export class Session {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ unique: true, nullable: false, length: 20 })
    name!: string;

    @Column({ name: 'start_date', type: 'date', nullable: false })
    startDate!: string;

    @Column({ name: 'end_date', type: 'date', nullable: false })
    endDate!: string;

    @Column({ name: 'is_active', default: false })
    isActive!: boolean;

    @Column({ name: 'activities_description', type: 'text', nullable: true })
    activitiesDescription?: string;

    @OneToMany(() => Term, (term) => term.session)
    terms!: Term[];
}
