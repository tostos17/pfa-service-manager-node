import { Router } from 'express';
import { playerDataService } from '../service/PlayerDataService';
import multer from 'multer';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.put('/:playerId/passport', authenticateJwt, upload.single('passportPhoto'), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            throw new Error('No file uploaded.');
        }
        const updatedUrl = await playerDataService.updatePlayerPassport(
            req.params.playerId,
            file.buffer,
            file.originalname,
            file.mimetype
        );
        return res.send(updatedUrl);
    } catch (err) {
        next(err);
    }
});

router.get('/', authenticateJwt, requireRoles(['ADMIN', 'DIRECTOR']), async (req, res, next) => {
    try {
        const page = parseInt(req.query.page as string || '0');
        const size = parseInt(req.query.size as string || '20');

        const result = await playerDataService.getPlayers(page, size);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

router.put('/:id/status', authenticateJwt, requireRoles(['ADMIN']), async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        const result = await playerDataService.updatePlayerStatus(id, status);
        return res.json({ success: true, body: result, message: 'Player status updated successfully' });
    } catch (err) {
        next(err);
    }
});

export default router;
