import { Router } from 'express';
import { trainingService } from '../service/TrainingService';
import { AppDataSource } from '../config/database';
import { Coach } from '../model/Coach';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

// Schedule a new training session
router.post('/', authenticateJwt, requireRoles(['ADMIN', 'COACH']), async (req, res, next) => {
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

// Submit batch attendance for a session
router.post('/:id/attendance', authenticateJwt, requireRoles(['ADMIN', 'COACH']), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const { records } = req.body;
        const result = await trainingService.submitAttendance(id, records || []);
        return res.json({ success: true, body: result, message: 'Attendance records logged successfully' });
    } catch (err) {
        next(err);
    }
});

export default router;
