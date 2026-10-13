import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity('parent_onboarding_tokens')
export class ParentOnboardingToken {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ length: 20, nullable: false })
    phone!: string;

    @Column({ name: 'access_key', length: 64, nullable: false, unique: true })
    accessKey!: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'created_by' })
    createdBy!: User;

    @Column({ default: false })
    used!: boolean;

    @Column({ name: 'expires_at', type: 'timestamp', nullable: false })
    expiresAt!: Date;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt!: Date;
}
