import { AppDataSource } from '../config/database';
import { TrainingSession } from '../model/TrainingSession';
import { TrainingAttendance } from '../model/TrainingAttendance';
import { Player } from '../model/Player';
import { Coach } from '../model/Coach';

export class TrainingService {
    isSessionEnded(session: { status: string; date?: string | Date; endTime?: string }): boolean {
        if (!session) return false;
        if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
            return true;
        }
        if (session.date && session.endTime) {
            try {
                const dateStr = typeof session.date === 'string'
                    ? session.date.substring(0, 10)
                    : new Date(session.date).toISOString().substring(0, 10);
                const timeStr = session.endTime.length === 5 ? `${session.endTime}:00` : session.endTime;
                const endDateTime = new Date(`${dateStr}T${timeStr}`);
                if (!isNaN(endDateTime.getTime()) && endDateTime.getTime() <= Date.now()) {
                    return true;
                }
            } catch (e) {
                // Ignore parse errors and fallback to status
            }
        }
        return false;
    }

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
        const sessions = await sessionRepository.find({
            order: {
                date: 'DESC',
                startTime: 'DESC'
            }
        });
        return sessions.map(s => ({
            ...s,
            isEnded: this.isSessionEnded(s)
        }));
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
            session: {
                ...session,
                isEnded: this.isSessionEnded(session)
            },
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

    async submitAttendance(sessionId: number, records: any[], options?: { endSession?: boolean }) {
        return await AppDataSource.transaction(async (transactionManager) => {
            const sessionRepository = transactionManager.getRepository(TrainingSession);
            const attendanceRepository = transactionManager.getRepository(TrainingAttendance);
            const playerRepository = transactionManager.getRepository(Player);
            const coachRepository = transactionManager.getRepository(Coach);

            const session = await sessionRepository.findOne({ where: { id: sessionId } });
            if (!session) {
                throw new Error(`Training session not found with ID: ${sessionId}`);
            }

            let savedCount = 0;

            for (const record of records) {
                if (record.attendeeType === 'PLAYER') {
                    let attendee = await attendanceRepository.findOne({
                        where: {
                            trainingSession: { id: sessionId },
                            player: { id: Number(record.id) }
                        },
                        relations: ['player']
                    });

                    if (!attendee) {
                        const player = await playerRepository.findOne({ where: { id: Number(record.id) } });
                        if (!player) {
                            throw new Error(`Player not found with ID: ${record.id}`);
                        }
                        attendee = attendanceRepository.create({
                            trainingSession: session,
                            player,
                            attendeeType: 'PLAYER',
                            status: record.status || 'PRESENT',
                            remarks: record.remarks !== undefined ? record.remarks : null
                        });
                    } else {
                        attendee.status = record.status || attendee.status;
                        if (record.remarks !== undefined) {
                            attendee.remarks = record.remarks;
                        }
                    }

                    await attendanceRepository.save(attendee);
                    savedCount++;
                } else if (record.attendeeType === 'COACH') {
                    let attendee = await attendanceRepository.findOne({
                        where: {
                            trainingSession: { id: sessionId },
                            coach: { id: Number(record.id) }
                        },
                        relations: ['coach']
                    });

                    if (!attendee) {
                        const coach = await coachRepository.findOne({ where: { id: Number(record.id) } });
                        if (!coach) {
                            throw new Error(`Coach not found with ID: ${record.id}`);
                        }
                        attendee = attendanceRepository.create({
                            trainingSession: session,
                            coach,
                            attendeeType: 'COACH',
                            status: record.status || 'PRESENT',
                            remarks: record.remarks !== undefined ? record.remarks : null
                        });
                    } else {
                        attendee.status = record.status || attendee.status;
                        if (record.remarks !== undefined) {
                            attendee.remarks = record.remarks;
                        }
                    }

                    await attendanceRepository.save(attendee);
                    savedCount++;
                }
            }

            // Update session status appropriately
            if (options?.endSession) {
                session.status = 'COMPLETED';
                await sessionRepository.save(session);
            } else if (session.status === 'SCHEDULED' && savedCount > 0) {
                session.status = 'IN_PROGRESS';
                await sessionRepository.save(session);
            }

            return {
                message: 'Attendance records logged successfully',
                recordsCount: savedCount,
                sessionStatus: session.status,
                isEnded: this.isSessionEnded(session)
            };
        });
    }

    async endSession(sessionId: number, options?: { markUnrecordedAsAbsent?: boolean }) {
        return await AppDataSource.transaction(async (transactionManager) => {
            const sessionRepository = transactionManager.getRepository(TrainingSession);
            const attendanceRepository = transactionManager.getRepository(TrainingAttendance);
            const playerRepository = transactionManager.getRepository(Player);

            const session = await sessionRepository.findOne({
                where: { id: sessionId },
                relations: ['attendanceLines', 'attendanceLines.player']
            });

            if (!session) {
                throw new Error(`Training session not found with ID: ${sessionId}`);
            }

            if (options?.markUnrecordedAsAbsent) {
                const eligiblePlayers = await playerRepository.find({ where: { status: 'ACTIVE' } });
                const existingPlayerIds = new Set(
                    (session.attendanceLines || [])
                        .filter(l => l.attendeeType === 'PLAYER' && l.player)
                        .map(l => Number(l.player?.id))
                );

                const absentRecords: TrainingAttendance[] = [];
                for (const player of eligiblePlayers) {
                    if (!existingPlayerIds.has(Number(player.id))) {
                        absentRecords.push(
                            attendanceRepository.create({
                                trainingSession: session,
                                player,
                                attendeeType: 'PLAYER',
                                status: 'ABSENT',
                                remarks: 'Auto-marked absent upon session conclusion'
                            })
                        );
                    }
                }

                if (absentRecords.length > 0) {
                    await attendanceRepository.save(absentRecords);
                }
            }

            session.status = 'COMPLETED';
            await sessionRepository.save(session);

            return {
                message: 'Training session concluded successfully',
                session: {
                    ...session,
                    isEnded: true
                }
            };
        });
    }
}

export const trainingService = new TrainingService();
