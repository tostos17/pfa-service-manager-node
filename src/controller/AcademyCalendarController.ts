import { Router } from 'express';
import { academyCalendarService } from '../service/AcademyCalendarService';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']));

router.get('/sessions/active-forward', async (req, res, next) => {
    try {
        const result = await academyCalendarService.fetchSessionsFromCurrentForward();
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.get('/sessions/lastfive', async (req, res, next) => {
    try {
        const result = await academyCalendarService.fetchLastFiveSessions();
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.post('/sessions', async (req, res, next) => {
    try {
        const name = (req.body.name || req.query.name) as string;
        const startDate = (req.body.startDate || req.query.startDate) as string;
        const endDate = (req.body.endDate || req.query.endDate) as string;
        const activities = (req.body.activities || req.query.activities) as string | undefined;
        const savedSession = await academyCalendarService.initializeNewSession(name, startDate, endDate, activities);
        return res.send(`Session ${savedSession.name} initialized cleanly with 3 terms.`);
    } catch (err) {
        next(err);
    }
});

router.post('/sessions/:id/start', async (req, res, next) => {
    try {
        await academyCalendarService.activateSessionFramework(parseInt(req.params.id));
        return res.send('Session workspace declared active.');
    } catch (err) {
        next(err);
    }
});

router.post('/sessions/:id/stop', async (req, res, next) => {
    try {
        await academyCalendarService.deactivateSessionFramework(parseInt(req.params.id));
        return res.send('Session workspace closed and archived cleanly.');
    } catch (err) {
        next(err);
    }
});

router.post('/terms/:id/start', async (req, res, next) => {
    try {
        await academyCalendarService.activateTermWindow(parseInt(req.params.id));
        return res.send('Term context marked live.');
    } catch (err) {
        next(err);
    }
});

router.post('/terms/:id/stop', async (req, res, next) => {
    try {
        await academyCalendarService.deactivateTermWindow(parseInt(req.params.id));
        return res.send('Term context closed successfully.');
    } catch (err) {
        next(err);
    }
});

router.put('/terms/:id/dates', async (req, res, next) => {
    try {
        const startDate = (req.body.startDate || req.query.startDate) as string;
        const endDate = (req.body.endDate || req.query.endDate) as string;
        await academyCalendarService.updateTermTimelineBounds(parseInt(req.params.id), startDate, endDate);
        return res.send('Term operating date envelope modified successfully.');
    } catch (err) {
        next(err);
    }
});

export default router;
