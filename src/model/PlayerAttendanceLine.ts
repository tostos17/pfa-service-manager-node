import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AttendanceEvent } from './AttendanceEvent';
import { Player } from './Player';

@Entity('player_attendance_lines')
export class PlayerAttendanceLine {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => AttendanceEvent, (event) => event.attendanceLines, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    attendanceEvent!: AttendanceEvent;

    @ManyToOne(() => Player, { nullable: false })
    @JoinColumn({ name: 'player_id' })
    player!: Player;

    @Column({ length: 20, nullable: false })
    status!: string; // PRESENT, ABSENT, EXCUSED, INJURED

    @Column({ nullable: true })
    remarks?: string;
}
