import { Router } from 'express';
import { portalService } from '../service/PortalService';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

// 1. Player Dashboard Endpoint
router.get('/player/dashboard', authenticateJwt, requireRoles(['PLAYER']), async (req: any, res, next) => {
    try {
        const userId = req.user.id;
        const result = await portalService.getPlayerDashboard(userId);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

// 2. Parent Dashboard Endpoint
router.get('/parent/dashboard', authenticateJwt, requireRoles(['PARENT']), async (req: any, res, next) => {
    try {
        const userId = req.user.id;
        const result = await portalService.getParentDashboard(userId);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

// 3. Parent Linked Child Details Endpoint
router.get('/parent/child/:id', authenticateJwt, requireRoles(['PARENT']), async (req: any, res, next) => {
    try {
        const parentUserId = req.user.id;
        const childId = parseInt(req.params.id);
        const result = await portalService.getParentChildDetails(parentUserId, childId);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

export default router;
