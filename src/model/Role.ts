import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('roles')
export class Role {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ unique: true, nullable: false })
    name!: string;
}
