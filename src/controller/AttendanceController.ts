import { Router } from 'express';
import { attendanceService } from '../service/AttendanceService';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

router.post('/batch', authenticateJwt, requireRoles(['ADMIN', 'COACH']), async (req, res, next) => {
    try {
        await attendanceService.submitBatchAttendance(req.body);
        return res.send('Roster training attendance logged successfully.');
    } catch (err) {
        next(err);
    }
});

export default router;
