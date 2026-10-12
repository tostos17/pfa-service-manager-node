import { Router } from 'express';
import { trainingService } from '../service/TrainingService';
import { AppDataSource } from '../config/database';
import { Coach } from '../model/Coach';
import { TrainingSession } from '../model/TrainingSession';
import { authenticateJwt, requireRoles, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Schedule a new training session
router.post('/', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR', 'COACH']), async (req, res, next) => {
    try {
        const result = await trainingService.createSession(req.body);
        return res.status(201).json({ success: true, body: result, message: 'Training session scheduled successfully' });
    } catch (err) {
        next(err);
    }
});

// Retrieve all training sessions
router.get('/', authenticateJwt, async (req, res, next) => {
    try {
        const result = await trainingService.getAllSessions();
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

// Retrieve all coaches/officials for attendance marking list selection
router.get('/coaches', authenticateJwt, async (req, res, next) => {
    try {
        const coachRepository = AppDataSource.getRepository(Coach);
        const coaches = await coachRepository.find();
        const mapped = coaches.map(c => ({
            id: Number(c.id),
            firstName: c.firstName,
            lastName: c.lastName,
            employeeId: c.employeeId
        }));
        return res.json({ success: true, body: mapped });
    } catch (err) {
        next(err);
    }
});

// Retrieve a single training session's details and rosters
router.get('/:id', authenticateJwt, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const result = await trainingService.getSessionById(id);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

// Submit/update attendance records for a session (incremental check-in or full sheet)
router.post('/:id/attendance', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR', 'COACH']), async (req: AuthenticatedRequest, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const sessionRepo = AppDataSource.getRepository(TrainingSession);
        const session = await sessionRepo.findOne({ where: { id } });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Not Found', message: `Training session not found with ID: ${id}` });
        }

        const isEnded = trainingService.isSessionEnded(session);
        if (isEnded) {
            const userRoles = (req.user?.roles || []).map((r: string) => r.toUpperCase());
            const isAdminOrDirector = userRoles.some((r: string) =>
                r === 'ADMIN' || r === 'ROLE_ADMIN' ||
                r === 'DIRECTOR' || r === 'ROLE_DIRECTOR'
            );

            if (!isAdminOrDirector) {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden',
                    message: 'Only administrators and directors can update attendance after the session has ended.'
                });
            }
        }

        const { records, endSession } = req.body;
        const result = await trainingService.submitAttendance(id, records || [], { endSession: Boolean(endSession) });
        return res.json({ success: true, body: result, message: 'Attendance records logged successfully' });
    } catch (err) {
        next(err);
    }
});

// Conclude an active training session
router.post('/:id/end', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR', 'COACH']), async (req: AuthenticatedRequest, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const { markUnrecordedAsAbsent } = req.body;
        const result = await trainingService.endSession(id, { markUnrecordedAsAbsent: Boolean(markUnrecordedAsAbsent) });
        return res.json({ success: true, body: result, message: 'Training session concluded successfully' });
    } catch (err) {
        next(err);
    }
});

export default router;
