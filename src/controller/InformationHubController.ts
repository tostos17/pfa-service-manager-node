import { Router } from 'express';
import { informationHubService } from '../service/InformationHubService';
import { AnnouncementType, PublicationStatus } from '../model/InformationHub';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

// Administrative routes
router.post('/admin/information-hub', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const adminId = parseInt((req.query.adminId || req.body.adminId) as string);
        const result = await informationHubService.createAnnouncement(req.body, adminId);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.patch('/admin/information-hub/:id/status', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const status = (req.body.status || req.query.status) as PublicationStatus;
        const result = await informationHubService.updateStatus(id, status);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/information-hub', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const type = (req.body.type || req.query.type) as AnnouncementType | undefined;
        const status = (req.body.status || req.query.status) as PublicationStatus | undefined;
        const page = parseInt(req.query.page as string || '0');
        const size = parseInt(req.query.size as string || '15');

        const result = await informationHubService.getAdminControlListing(type, status, page, size);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.delete('/admin/information-hub/:id', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        await informationHubService.deleteAnnouncement(parseInt(req.params.id));
        return res.send('Resource deleted from hub master logs.');
    } catch (err) {
        next(err);
    }
});

// Public Feed routes
router.get('/public/information-hub/feed', async (req, res, next) => {
    try {
        const type = (req.body.type || req.query.type) as AnnouncementType | undefined;
        const page = parseInt(req.query.page as string || '0');
        const size = parseInt(req.query.size as string || '10');

        const result = await informationHubService.getPublicFeed(type, page, size);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

export default router;
