import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Term } from './Term';

@Entity('academy_expenses')
export class AcademyExpense {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ length: 150, nullable: false })
    title!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, nullable: false })
    amount!: number;

    @Column({ length: 50, nullable: false })
    category!: string;

    @Column({ name: 'expense_date', type: 'date', nullable: false })
    expenseDate!: string;

    @Column({ length: 30, default: 'PENDING' })
    status!: string; // PENDING, APPROVED, REJECTED

    @Column({ name: 'receipt_url', length: 500, nullable: true })
    receiptUrl?: string;

    @ManyToOne(() => Term, { nullable: false })
    @JoinColumn({ name: 'term_id' })
    term!: Term;

    @Column({ name: 'recorded_by_admin_id', type: 'bigint', nullable: false })
    recordedByAdminId!: number;

    @Column({ name: 'approved_by_admin_id', type: 'bigint', nullable: true })
    approvedByAdminId?: number;

    @Column({ name: 'created_at', type: 'timestamp', nullable: false })
    createdAt!: Date;

    @Column({ name: 'updated_at', type: 'timestamp', nullable: false })
    updatedAt!: Date;

    @BeforeInsert()
    onCreate() {
        this.createdAt = new Date();
        this.updatedAt = new Date();
        if (!this.status) this.status = 'PENDING';
    }

    @BeforeUpdate()
    onUpdate() {
        this.updatedAt = new Date();
    }
}
