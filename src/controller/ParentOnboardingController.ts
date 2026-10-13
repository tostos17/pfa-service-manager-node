import { Router, Request, Response, NextFunction } from 'express';
import { parentOnboardingService } from '../service/ParentOnboardingService';
import { authenticateJwt, requireRoles, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/v1/onboarding/parent/generate-key
 * DIRECTOR ONLY — Enter a parent's phone number to generate a one-time access key.
 *
 * Body: { phone: string }
 * Returns: { accessKey, phone, expiresAt }
 */
router.post(
    '/parent/generate-key',
    authenticateJwt,
    requireRoles(['DIRECTOR']),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { phone } = req.body;
            if (!phone || !phone.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number is required'
                });
            }
            const directorUserId = req.user!.id;
            const result = await parentOnboardingService.generateAccessKey(phone, directorUserId);
            return res.status(201).json({
                success: true,
                message: `Access key generated for ${result.phone}. Share it securely with the parent/guardian.`,
                body: result
            });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * POST /api/v1/onboarding/parent/verify-key
 * PUBLIC — Parent submits their phone number and the access key given by the director.
 * On success, a short-lived (15 min) verification JWT is returned to gate the /register step.
 *
 * Body: { phone: string, accessKey: string }
 * Returns: { verificationToken: string }
 */
router.post('/parent/verify-key', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone, accessKey } = req.body;
        if (!phone || !accessKey) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and access key are required'
            });
        }
        const result = await parentOnboardingService.verifyAccessKey(phone, accessKey);
        return res.json({
            success: true,
            message: 'Access key verified. You may now proceed to complete your registration.',
            body: result
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/onboarding/parent/register
 * Semi-public — Protected by the verification JWT from /verify-key (not a full user JWT).
 * Parent submits the full registration form.
 *
 * Headers: Authorization: Bearer <verificationToken>
 * Body: {
 *   title, firstName, lastName, relationship, email,
 *   address, occupation, username, password
 * }
 * Returns: { message, parentId }
 */
router.post('/parent/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Verification token is required. Please complete the key verification step first.'
            });
        }
        const verificationToken = authHeader.split(' ')[1];

        // Decode & validate the short-lived verification token
        const { tokenId, phone } = parentOnboardingService.decodeVerificationToken(verificationToken);

        const { title, firstName, lastName, relationship, email, address, occupation, username, password } = req.body;

        if (!firstName || !lastName || !email || !address || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: firstName, lastName, email, address, username, password'
            });
        }

        const result = await parentOnboardingService.completeRegistration(tokenId, phone, req.body);
        return res.status(201).json({
            success: true,
            message: result.message,
            body: { parentId: result.parentId }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/onboarding/parent/:id/consent-form
 * DIRECTOR ONLY — Retrieve a registered parent's complete data for the printable consent form.
 *
 * Returns: { formData, consentStatement, generatedAt }
 */
router.get(
    '/parent/:id/consent-form',
    authenticateJwt,
    requireRoles(['DIRECTOR']),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const parentId = parseInt(req.params.id);
            if (isNaN(parentId)) {
                return res.status(400).json({ success: false, message: 'Invalid parent ID' });
            }
            const result = await parentOnboardingService.getConsentFormData(parentId);
            return res.json({ success: true, body: result });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
