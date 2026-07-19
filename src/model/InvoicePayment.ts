import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, BeforeInsert } from 'typeorm';
import { Payment } from './Payment';
import { Invoice } from './Invoice';

@Entity('invoice_payments')
export class InvoicePayment {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => Payment, { nullable: false })
    @JoinColumn({ name: 'payment_id' })
    payment!: Payment;

    @ManyToOne(() => Invoice, { nullable: false })
    @JoinColumn({ name: 'invoice_id' })
    invoice!: Invoice;

    @Column({ name: 'amount_paid', type: 'numeric', precision: 12, scale: 2, nullable: false })
    amountPaid!: number;

    @Column({ name: 'created_at', type: 'timestamp', nullable: false })
    createdAt!: Date;

    @BeforeInsert()
    onCreate() {
        this.createdAt = new Date();
    }
}
