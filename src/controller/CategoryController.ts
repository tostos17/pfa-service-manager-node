import { Router } from 'express';
import { categoryService } from '../service/CategoryService';
import { authenticateJwt } from '../middleware/auth';

const router = Router();

router.get('/', authenticateJwt, async (req, res, next) => {
    try {
        const result = await categoryService.getAllCategories();
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

export default router;
