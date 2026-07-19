import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, BeforeInsert } from 'typeorm';
import { Account } from './Account';
import { Term } from './Term';

@Entity('invoices')
export class Invoice {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Account, { nullable: false })
    @JoinColumn({ name: 'account_player_id' })
    account!: Account;

    @ManyToOne(() => Term, { nullable: false })
    @JoinColumn({ name: 'term_id' })
    term!: Term;

    @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, nullable: false })
    totalAmount!: number;

    @Column({ name: 'amount_due', type: 'numeric', precision: 12, scale: 2, nullable: false })
    amountDue!: number;

    @Column({ length: 50, nullable: false })
    category!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ length: 30, default: 'UNSETTLED' })
    status!: string; // UNSETTLED, PARTIALLY_PAID, SETTLED

    @Column({ name: 'created_at', type: 'timestamp', nullable: false })
    createdAt!: Date;

    @BeforeInsert()
    onCreate() {
        this.createdAt = new Date();
    }
}
