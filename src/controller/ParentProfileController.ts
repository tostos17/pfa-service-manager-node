import { Router } from 'express';
import { parentProfileService } from '../service/ParentProfileService';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

router.get('/:username/my-roster', authenticateJwt, async (req, res, next) => {
    try {
        const result = await parentProfileService.getChildrenRoster(req.params.username);
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/:id/my-roster/byId', authenticateJwt, async (req, res, next) => {
    try {
        const result = await parentProfileService.getChildrenRosterById(parseInt(req.params.id));
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const search = req.query.search as string | undefined;
        const page = parseInt(req.query.page as string || '0');
        const size = parseInt(req.query.size as string || '20');

        const result = await parentProfileService.getParents(search, page, size);
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/:id', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await parentProfileService.getParentById(parseInt(req.params.id));
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/:username/children/unsettled-invoices', authenticateJwt, async (req, res, next) => {
    try {
        const result = await parentProfileService.getChildrenUnsettledInvoices(req.params.username);
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/:username/payments', authenticateJwt, async (req, res, next) => {
    try {
        const result = await parentProfileService.getParentPaymentHistory(req.params.username);
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

export default router;
