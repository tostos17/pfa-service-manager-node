import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TrainingAttendance } from './TrainingAttendance';

@Entity('training_sessions')
export class TrainingSession {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ nullable: false })
    theme!: string;

    @Column({ name: 'session_date', type: 'date', nullable: false })
    date!: string;

    @Column({ name: 'start_time', type: 'time', nullable: false })
    startTime!: string;

    @Column({ name: 'end_time', type: 'time', nullable: false })
    endTime!: string;

    @Column({ type: 'text', nullable: true })
    activities?: string;

    @Column({ length: 30, default: 'SCHEDULED' })
    status!: string; // SCHEDULED, COMPLETED, CANCELLED

    @OneToMany(() => TrainingAttendance, (attendance) => attendance.trainingSession, { cascade: true })
    attendanceLines!: TrainingAttendance[];
}
