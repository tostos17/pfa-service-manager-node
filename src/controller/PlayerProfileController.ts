import { Router } from 'express';
import { playerProfileService } from '../service/PlayerProfileService';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

// Route mappings aligned with Java player profile endpoints
router.put('/create/:playerId', authenticateJwt, async (req, res, next) => {
    try {
        const result = await playerProfileService.createOrUpdateProfile(req.params.playerId, req.body);
        return res.json({ success: true, body: result, message: 'Profile updated' });
    } catch (err) {
        next(err);
    }
});

router.get('/all', authenticateJwt, requireRoles(['ADMIN', 'COACH', 'DIRECTOR']), async (req, res, next) => {
    try {
        const search = req.query.search as string | undefined;
        const pageNumber = parseInt(req.query.pageNumber as string || '0');
        const pageSize = parseInt(req.query.pageSize as string || '10');

        const result = await playerProfileService.getAllPlayerProfiles(search, pageNumber, pageSize);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.put('/squadnumber', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await playerProfileService.updateSquadNumber(req.body);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.put('/height', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await playerProfileService.updatePlayerHeight(req.body);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.put('/weight', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await playerProfileService.updatePlayerWeight(req.body);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.put('/position', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await playerProfileService.updatePlayerPosition(req.body);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.put('/category', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await playerProfileService.updatePlayerCategory(req.body);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.put('/foot', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await playerProfileService.updateDominantFoot(req.body);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.get('/:playerId/stats', authenticateJwt, async (req, res, next) => {
    try {
        const result = await playerProfileService.getPlayerStats(req.params.playerId);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.get('/:playerId', authenticateJwt, async (req, res, next) => {
    try {
        const result = await playerProfileService.getProfileByPlayerId(req.params.playerId);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

export default router;
