import { Router } from 'express';
import { billingService } from '../service/BillingService';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

// 1. Ledger Summary
router.get('/ledger-summary', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await billingService.calculateActiveTermLedgerMatrix();
        return res.json({ success: true, body: result, message: 'Ledger statement matrix loaded successfully.' });
    } catch (err) {
        next(err);
    }
});

// 2. Invoice Endpoints
router.get('/invoices', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const status = req.query.status as string | undefined;
        const session = req.query.session as string | undefined;
        const term = req.query.term as string | undefined;

        const result = await billingService.getAllInvoices(status, session, term);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.post('/invoices', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await billingService.issueInvoiceToPlayer(undefined, req.body);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.get('/invoices/finance/accounts/:accountId/unsettled-invoices', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await billingService.getUnsettledInvoicesByAccount(req.params.accountId);
        return res.json({ success: true, body: result, message: 'Outstanding unsettled invoices retrieved successfully.' });
    } catch (err) {
        next(err);
    }
});

router.get('/invoices/:invoiceId/part-payments', authenticateJwt, async (req, res, next) => {
    try {
        const result = await billingService.getPartPaymentsByInvoice(parseInt(req.params.invoiceId));
        return res.json({ success: true, body: result, message: 'Part payments retrieved successfully.' });
    } catch (err) {
        next(err);
    }
});

// 3. Payment Processing
router.post('/payments', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const result = await billingService.processPlayerPayment(undefined, req.body);
        return res.json({ success: true, body: result, message: 'Payment applied into active ledger successfully against invoices.' });
    } catch (err) {
        next(err);
    }
});

export default router;
