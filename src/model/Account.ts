import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Player } from './Player';

@Entity('accounts')
export class Account {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @OneToOne(() => Player, (player) => player.account, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    player!: Player;

    @Column({ name: 'account_id', unique: true, nullable: false })
    accountId!: string;

    @Column({ default: true })
    status!: boolean;

    @Column({ name: 'brought_forward', type: 'numeric', precision: 15, scale: 2, default: 0 })
    broughtForward!: number;

    @Column({ default: false })
    discounted!: boolean;

    @Column({ name: 'percent_discount', type: 'double precision', default: 0.0 })
    percentDiscount!: number;
}
