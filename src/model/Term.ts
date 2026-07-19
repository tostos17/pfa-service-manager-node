import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Session } from './Session';

@Entity('terms')
export class Term {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Session, (session) => session.terms, { nullable: false })
    @JoinColumn({ name: 'session_id' })
    session!: Session;

    @Column({ nullable: false, length: 30 })
    name!: string;

    @Column({ name: 'start_date', type: 'date', nullable: false })
    startDate!: string;

    @Column({ name: 'end_date', type: 'date', nullable: false })
    endDate!: string;

    @Column({ name: 'is_current_active', default: false })
    isCurrentActive!: boolean;

    @Column({ name: 'syllabus_url', length: 500, nullable: true })
    syllabusUrl?: string;

    @Column({ name: 'matches_description', type: 'text', nullable: true })
    matchesDescription?: string;

    @Column({ name: 'assessment_description', type: 'text', nullable: true })
    assessmentDescription?: string;

    @Column({ name: 'results_summary', type: 'text', nullable: true })
    resultsSummary?: string;

    @Column({ name: 'opening_account_balance', type: 'numeric', precision: 12, scale: 2, default: 0 })
    openingAccountBalance!: number;

    @Column({ name: 'closing_account_balance', type: 'numeric', precision: 12, scale: 2, default: 0 })
    closingAccountBalance!: number;
}
