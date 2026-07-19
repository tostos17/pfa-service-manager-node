import { Response, Router } from 'express';
import { authService } from '../service/AuthService';
import multer from 'multer';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/login', async (req, res, next) => {
    try {
        const result = await authService.login(req.body);
        return res.json({ success: true, body: result, message: 'Login successful' });
    } catch (err) {
        next(err);
    }
});

router.post('/register', async (req, res, next) => {
    try {
        const result = await authService.register(req.body);
        return res.json({ success: true, body: result, message: 'User registered successfully' });
    } catch (err) {
        next(err);
    }
});

router.post('/register/coach', async (req, res, next) => {
    try {
        const result = await authService.registerCoach(req.body);
        return res.json({ success: true, body: result, message: 'Coach registered successfully' });
    } catch (err) {
        next(err);
    }
});

router.post('/register/player', upload.single('passportPhoto'), async (req, res, next) => {
    try {
        const file = req.file;
        const result = await authService.registerPlayer(
            req.body,
            file ? file.buffer : undefined,
            file ? file.originalname : undefined,
            file ? file.mimetype : undefined
        );
        return res.status(201).json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
});

router.post('/register/admin', async (req, res, next) => {
    try {
        const result = await authService.registerAdmin(req.body);
        return res.json({ success: true, body: result, message: 'Admin registered successfully' });
    } catch (err) {
        next(err);
    }
});

router.post('/register/director', async (req, res, next) => {
    try {
        const result = await authService.registerDirector(req.body);
        return res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
});

router.post('/register/parent', async (req, res, next) => {
    try {
        const result = await authService.registerParent(req.body);
        return res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
});

router.put('/parent/:id', authenticateJwt, async (req, res, next) => {
    try {
        const result = await authService.updateParent(parseInt(req.params.id), req.body);
        return res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
});

router.post('/force-change-password', authenticateJwt, async (req: any, res, next) => {
    try {
        const userId = req.user.id;
        const result = await authService.forceChangePassword(userId, req.body);
        return res.json({ success: true, body: result, message: 'Password updated successfully' });
    } catch (err) {
        next(err);
    }
});

export default router;
