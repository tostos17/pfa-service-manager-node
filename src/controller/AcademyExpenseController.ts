import { Router } from 'express';
import { academyExpenseService } from '../service/AcademyExpenseService';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']));

router.post('/', async (req, res, next) => {
    try {
        const currentAuthenticatedAdminId = 1; // Simulation placeholder matched with Java implementation
        const result = await academyExpenseService.recordExpense(req.body, currentAuthenticatedAdminId);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.patch('/:id/status', async (req, res, next) => {
    try {
        const currentAuthenticatedAdminId = 1;
        const status = (req.body.status || req.query.status) as string;
        const result = await academyExpenseService.evaluateExpenseStatus(
            parseInt(req.params.id),
            status,
            currentAuthenticatedAdminId
        );
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const status = (req.body.status || req.query.status) as string | undefined;
        const category = (req.body.category || req.query.category) as string | undefined;
        const startDate = (req.body.startDate || req.query.startDate) as string | undefined;
        const endDate = (req.body.endDate || req.query.endDate) as string | undefined;

        const result = await academyExpenseService.fetchFilteredLedger(status, category, startDate, endDate);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.get('/audit/terms/:termId', async (req, res, next) => {
    try {
        const result = await academyExpenseService.computeTermFinancialAudit(parseInt(req.params.termId));
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

export default router;
