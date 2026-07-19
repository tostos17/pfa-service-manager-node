import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, BeforeInsert } from 'typeorm';
import { User } from './User';

@Entity('parents')
export class Parent {
    @PrimaryColumn({ type: 'bigint' })
    id!: number;

    @Column({ length: 20, nullable: true })
    title?: string;

    @Column({ name: 'first_name', length: 50, nullable: false })
    firstName!: string;

    @Column({ name: 'last_name', length: 50, nullable: false })
    lastName!: string;

    @Column({ length: 20, nullable: false })
    phone!: string;

    @Column({ length: 100, unique: true, nullable: false })
    email!: string;

    @Column({ type: 'text', nullable: false })
    address!: string;

    @Column({ name: 'registration_date', type: 'timestamp', nullable: false })
    registrationDate!: Date;

    @OneToOne(() => User, (user) => user.parent, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id' })
    user!: User;

    @BeforeInsert()
    onCreate() {
        this.registrationDate = new Date();
    }
}
