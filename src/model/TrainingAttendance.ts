import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TrainingSession } from './TrainingSession';
import { Player } from './Player';
import { Coach } from './Coach';

@Entity('training_attendance')
export class TrainingAttendance {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @ManyToOne(() => TrainingSession, (session) => session.attendanceLines, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'session_id' })
    trainingSession!: TrainingSession;

    @ManyToOne(() => Player, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'player_id' })
    player?: Player;

    @ManyToOne(() => Coach, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'coach_id' })
    coach?: Coach;

    @Column({ name: 'attendee_type', length: 20, nullable: false })
    attendeeType!: 'PLAYER' | 'COACH';

    @Column({ length: 20, nullable: false })
    status!: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'INJURED';

    @Column({ nullable: true })
    remarks?: string;
}
