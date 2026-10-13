import { Router } from 'express';
import { portalService } from '../service/PortalService';
import { authService } from '../service/AuthService';
import { authenticateJwt, requireRoles } from '../middleware/auth';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
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

// 4. Parent Register Child/Ward Endpoint
// Reuses the existing registerPlayer service; parentId is injected from the authenticated parent's JWT.
router.post(
    '/parent/register-child',
    authenticateJwt,
    requireRoles(['PARENT']),
    upload.single('passportPhoto'),
    async (req: any, res, next) => {
        try {
            const parentUserId = req.user.id;
            // Inject the authenticated parent's ID so the child is always linked correctly
            const body = { ...req.body, parentId: String(parentUserId) };
            const file = req.file;
            const result = await authService.registerPlayer(
                body,
                file ? file.buffer : undefined,
                file ? file.originalname : undefined,
                file ? file.mimetype : undefined
            );
            return res.status(201).json({ success: true, message: result.message });
        } catch (err) {
            next(err);
        }
    }
);

export default router;

