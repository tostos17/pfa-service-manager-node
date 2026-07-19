import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, BeforeInsert } from 'typeorm';
import { Account } from './Account';
import { Term } from './Term';
import { PaymentAllocation } from './PaymentAllocation';

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Account, { nullable: false })
    @JoinColumn({ name: 'account_player_id' })
    account!: Account;

    @Column({ name: 'amount_paid', type: 'numeric', precision: 12, scale: 2, nullable: false })
    amountPaid!: number;

    @Column({ name: 'reference_number', length: 100, unique: true, nullable: false })
    referenceNumber!: string;

    @Column({ name: 'payment_date', type: 'timestamp', nullable: false })
    paymentDate!: Date;

    @ManyToOne(() => Term, { nullable: false })
    @JoinColumn({ name: 'term_id' })
    term!: Term;

    @OneToMany(() => PaymentAllocation, (allocation) => allocation.payment)
    allocations!: PaymentAllocation[];

    @BeforeInsert()
    onCreate() {
        this.paymentDate = new Date();
    }
}
