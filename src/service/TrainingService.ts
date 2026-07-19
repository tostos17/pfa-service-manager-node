import { AppDataSource } from '../config/database';
import { TrainingSession } from '../model/TrainingSession';
import { TrainingAttendance } from '../model/TrainingAttendance';
import { Player } from '../model/Player';
import { Coach } from '../model/Coach';

export class TrainingService {
    async createSession(data: any) {
        const sessionRepository = AppDataSource.getRepository(TrainingSession);
        const session = sessionRepository.create({
            theme: data.theme,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            activities: data.activities,
            status: 'SCHEDULED'
        });
        return await sessionRepository.save(session);
    }

    async getAllSessions() {
        const sessionRepository = AppDataSource.getRepository(TrainingSession);
        return await sessionRepository.find({
            order: {
                date: 'DESC',
                startTime: 'DESC'
            }
        });
    }

    async getSessionById(id: number) {
        const sessionRepository = AppDataSource.getRepository(TrainingSession);
        const playerRepository = AppDataSource.getRepository(Player);
        const coachRepository = AppDataSource.getRepository(Coach);

        const session = await sessionRepository.findOne({
            where: { id },
            relations: ['attendanceLines', 'attendanceLines.player', 'attendanceLines.coach']
        });

        if (!session) {
            throw new Error(`Training session not found with ID: ${id}`);
        }

        // Fetch eligible players & coaches to help the frontend build the attendance sheet
        const eligiblePlayers = await playerRepository.find();
        const eligibleCoaches = await coachRepository.find();

        return {
            session,
            eligiblePlayers: eligiblePlayers.map(p => ({
                id: Number(p.id),
                firstName: p.firstName,
                lastName: p.lastName,
                playerId: p.playerId,
                status: p.status
            })),
            eligibleCoaches: eligibleCoaches.map(c => ({
                id: Number(c.id),
                firstName: c.firstName,
                lastName: c.lastName,
                employeeId: c.employeeId
            }))
        };
    }

    async submitAttendance(sessionId: number, records: any[]) {
        return await AppDataSource.transaction(async (transactionManager) => {
            const sessionRepository = transactionManager.getRepository(TrainingSession);
            const attendanceRepository = transactionManager.getRepository(TrainingAttendance);
            const playerRepository = transactionManager.getRepository(Player);
            const coachRepository = transactionManager.getRepository(Coach);

            const session = await sessionRepository.findOne({ where: { id: sessionId } });
            if (!session) {
                throw new Error(`Training session not found with ID: ${sessionId}`);
            }

            // Remove existing attendance records for clean/idempotent updates
            await attendanceRepository.delete({ trainingSession: { id: sessionId } });

            const newRecords: TrainingAttendance[] = [];

            for (const record of records) {
                const attendee = attendanceRepository.create({
                    trainingSession: session,
                    attendeeType: record.attendeeType,
                    status: record.status,
                    remarks: record.remarks || null
                });

                if (record.attendeeType === 'PLAYER') {
                    const player = await playerRepository.findOne({ where: { id: Number(record.id) } });
                    if (!player) {
                        throw new Error(`Player not found with ID: ${record.id}`);
                    }
                    attendee.player = player;
                } else if (record.attendeeType === 'COACH') {
                    const coach = await coachRepository.findOne({ where: { id: Number(record.id) } });
                    if (!coach) {
                        throw new Error(`Coach not found with ID: ${record.id}`);
                    }
                    attendee.coach = coach;
                }

                newRecords.push(attendee);
            }

            if (newRecords.length > 0) {
                await attendanceRepository.save(newRecords);
            }

            // Automatically transition status to COMPLETED
            session.status = 'COMPLETED';
            await sessionRepository.save(session);

            return { message: 'Attendance records logged successfully', recordsCount: newRecords.length };
        });
    }
}

export const trainingService = new TrainingService();
