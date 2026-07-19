import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Payment } from './Payment';
import { Invoice } from './Invoice';

@Entity('payment_allocations')
export class PaymentAllocation {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Payment, (payment) => payment.allocations, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payment_id' })
    payment!: Payment;

    @ManyToOne(() => Invoice, { nullable: false })
    @JoinColumn({ name: 'invoice_id' })
    invoice!: Invoice;

    @Column({ name: 'amount_allocated', type: 'numeric', precision: 38, scale: 2, nullable: false })
    amountAllocated!: number;

    @Column({ name: 'allocated_at', type: 'timestamp', nullable: false })
    allocatedAt!: Date;
}
