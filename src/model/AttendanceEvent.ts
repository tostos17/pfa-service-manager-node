import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { PlayerAttendanceLine } from './PlayerAttendanceLine';

@Entity('attendance_events')
export class AttendanceEvent {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ name: 'event_date', type: 'date', nullable: false })
    eventDate!: string;

    @Column({ name: 'event_type', length: 30, nullable: false })
    eventType!: string;

    @Column({ nullable: true })
    description?: string;

    @OneToMany(() => PlayerAttendanceLine, (line) => line.attendanceEvent, { cascade: true })
    attendanceLines!: PlayerAttendanceLine[];
}
