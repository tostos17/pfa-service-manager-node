import { Router } from 'express';
import { staffService } from '../service/StaffService';
import { authenticateJwt, requireRoles } from '../middleware/auth';

const router = Router();

// Restrict all staff management endpoints to Administrator
router.use(authenticateJwt, requireRoles(['ADMIN']));

// Retrieve all staff members
router.get('/', async (req, res, next) => {
    try {
        const { role, search } = req.query;
        const result = await staffService.getAllStaff({
            role: role as string | undefined,
            search: search as string | undefined
        });
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

// Retrieve single staff member details
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const result = await staffService.getStaffById(id);
        return res.json({ success: true, body: result });
    } catch (err) {
        next(err);
    }
});

// Create new coach
router.post('/coach', async (req, res, next) => {
    try {
        const result = await staffService.createCoach(req.body);
        return res.status(201).json({
            success: true,
            body: result,
            message: 'Coach profile created successfully'
        });
    } catch (err) {
        next(err);
    }
});

// Create new director
router.post('/director', async (req, res, next) => {
    try {
        const result = await staffService.createDirector(req.body);
        return res.status(201).json({
            success: true,
            body: result,
            message: 'Director profile created successfully'
        });
    } catch (err) {
        next(err);
    }
});

// Update staff details
router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const result = await staffService.updateStaff(id, req.body);
        return res.json({
            success: true,
            body: result,
            message: 'Staff details updated successfully'
        });
    } catch (err) {
        next(err);
    }
});

// Toggle staff active/enabled status
router.patch('/:id/status', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const { enabled } = req.body;
        const result = await staffService.toggleStaffStatus(id, enabled);
        return res.json({
            success: true,
            body: result,
            message: `Staff account ${result.enabled ? 'activated' : 'deactivated'} successfully`
        });
    } catch (err) {
        next(err);
    }
});

// Deactivate/delete staff member
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const result = await staffService.deleteStaff(id);
        return res.json({
            success: true,
            body: result,
            message: 'Staff account deactivated successfully'
        });
    } catch (err) {
        next(err);
    }
});

export default router;
