import { AppDataSource } from '../config/database';
import { AttendanceEvent } from '../model/AttendanceEvent';
import { Player } from '../model/Player';
import { PlayerAttendanceLine } from '../model/PlayerAttendanceLine';

export class AttendanceService {
    async submitBatchAttendance(request: any) {
        return await AppDataSource.transaction(async (transactionManager) => {
            const eventRepository = transactionManager.getRepository(AttendanceEvent);
            const playerRepository = transactionManager.getRepository(Player);
            const lineRepository = transactionManager.getRepository(PlayerAttendanceLine);

            const event = eventRepository.create({
                eventDate: request.eventDate,
                eventType: request.eventType.toUpperCase(),
                description: request.description,
                attendanceLines: []
            });

            const savedEvent = await eventRepository.save(event);
            const lines: PlayerAttendanceLine[] = [];

            for (const record of request.records) {
                const player = await playerRepository.findOne({ where: { playerId: record.playerId } });
                if (!player) {
                    throw new Error(`Attendance error: Player record not found for public ID: ${record.playerId}`);
                }

                const line = lineRepository.create({
                    attendanceEvent: savedEvent,
                    player,
                    status: record.status.toUpperCase(),
                    remarks: record.remarks
                });
                lines.push(line);
            }

            await lineRepository.save(lines);
        });
    }
}

export const attendanceService = new AttendanceService();
