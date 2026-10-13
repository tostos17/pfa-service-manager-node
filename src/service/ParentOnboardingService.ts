import { AppDataSource } from '../config/database';
import { ParentOnboardingToken } from '../model/ParentOnboardingToken';
import { User } from '../model/User';
import { Parent } from '../model/Parent';
import { Role } from '../model/Role';
import { AppError } from '../error/AppError';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyformigratedpfaapp';
const ACCESS_KEY_EXPIRY_DAYS = 30;
const VERIFICATION_TOKEN_EXPIRY = '15m';

export class ParentOnboardingService {

    /**
     * DIRECTOR ACTION: Generate a phone-bound access key for a prospective parent/guardian.
     * The returned access key must be shared with the parent by the director out-of-band.
     */
    async generateAccessKey(phone: string, directorUserId: number) {
        const userRepository = AppDataSource.getRepository(User);
        const tokenRepository = AppDataSource.getRepository(ParentOnboardingToken);

        const director = await userRepository.findOne({
            where: { id: directorUserId },
            relations: ['roles']
        });

        if (!director) {
            throw new AppError('Director user not found', 404, 'Not Found');
        }

        // Generate a cryptographically secure 12-character alphanumeric access key
        const accessKey = randomBytes(9).toString('base64url').substring(0, 12).toUpperCase();

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + ACCESS_KEY_EXPIRY_DAYS);

        const token = tokenRepository.create({
            phone: phone.trim(),
            accessKey,
            createdBy: director,
            used: false,
            expiresAt
        });

        await tokenRepository.save(token);

        return {
            phone: phone.trim(),
            accessKey,
            expiresAt
        };
    }

    /**
     * PARENT ACTION: Verify a phone + access key combination.
     * Returns a short-lived verification JWT that gates the /register endpoint.
     */
    async verifyAccessKey(phone: string, accessKey: string) {
        const tokenRepository = AppDataSource.getRepository(ParentOnboardingToken);

        const token = await tokenRepository.findOne({
            where: { phone: phone.trim(), accessKey: accessKey.trim().toUpperCase() }
        });

        if (!token) {
            throw new AppError('Invalid phone number or access key', 401, 'Unauthorized');
        }

        if (token.used) {
            throw new AppError('This access key has already been used', 409, 'Conflict');
        }

        if (new Date() > token.expiresAt) {
            throw new AppError('This access key has expired. Please contact the director for a new one.', 410, 'Gone');
        }

        // Issue a short-lived verification token encoding the tokenId and phone
        const verificationToken = jwt.sign(
            { tokenId: Number(token.id), phone: token.phone, type: 'PARENT_ONBOARDING' },
            JWT_SECRET,
            { expiresIn: VERIFICATION_TOKEN_EXPIRY }
        );

        return { verificationToken };
    }

    /**
     * PARENT ACTION: Complete registration using the verification token issued by verifyAccessKey.
     * Creates a User + Parent record and invalidates the onboarding token.
     */
    async completeRegistration(tokenId: number, phone: string, request: any) {
        const userRepository = AppDataSource.getRepository(User);
        const roleRepository = AppDataSource.getRepository(Role);
        const parentRepository = AppDataSource.getRepository(Parent);
        const tokenRepository = AppDataSource.getRepository(ParentOnboardingToken);

        // Re-validate the token (guard against race conditions or token replay after expiry)
        const onboardingToken = await tokenRepository.findOne({ where: { id: tokenId } });
        if (!onboardingToken || onboardingToken.used || new Date() > onboardingToken.expiresAt) {
            throw new AppError('Onboarding session is invalid or has expired. Please contact the director.', 410, 'Gone');
        }

        // Validate username uniqueness
        const existingUser = await userRepository.findOne({ where: { username: request.username } });
        if (existingUser) {
            throw new AppError('Username is already taken', 409, 'Conflict');
        }

        // Validate email uniqueness
        const existingEmail = await parentRepository.findOne({ where: { email: request.email } });
        if (existingEmail) {
            throw new AppError('An account with this email already exists', 409, 'Conflict');
        }

        const parentRole = await roleRepository.findOne({ where: { name: 'ROLE_PARENT' } });
        if (!parentRole) {
            throw new AppError('Parent role structure not initialized in database', 500, 'Internal Server Error');
        }

        const hashedPassword = await bcrypt.hash(request.password, 10);
        const user = userRepository.create({
            username: request.username,
            password: hashedPassword,
            requirePasswordChange: false,  // Parent chose their own password
            enabled: true,
            roles: [parentRole]
        });
        const savedUser = await userRepository.save(user);

        const parent = parentRepository.create({
            id: Number(savedUser.id),
            title: request.title || null,
            firstName: request.firstName,
            lastName: request.lastName,
            phone: phone.trim(),        // Use the phone from the verified token context
            email: request.email,
            address: request.address,
            relationship: request.relationship || null,
            occupation: request.occupation || null,
            user: savedUser
        });
        await parentRepository.save(parent);

        // Invalidate the onboarding token (single-use enforcement)
        onboardingToken.used = true;
        await tokenRepository.save(onboardingToken);

        return {
            message: `Registration successful. Welcome, ${parent.firstName}!`,
            parentId: Number(savedUser.id)
        };
    }

    /**
     * DIRECTOR ACTION: Retrieve all parent data formatted for the printable consent form.
     */
    async getConsentFormData(parentId: number) {
        const parentRepository = AppDataSource.getRepository(Parent);

        const parent = await parentRepository.findOne({
            where: { id: parentId },
            relations: ['user']
        });

        if (!parent) {
            throw new AppError(`Parent profile not found for ID: ${parentId}`, 404, 'Not Found');
        }

        const consentStatement = `I, ${parent.title ? parent.title + ' ' : ''}${parent.firstName} ${parent.lastName}, hereby give my consent for my child/ward to participate in all activities organised by the Football Academy. I confirm that the information provided in this form is accurate and complete to the best of my knowledge. I understand that my personal data will be held securely and used solely for the administration of the Academy's programmes. I agree to inform the Academy promptly of any changes to the information provided herein.`;

        return {
            formData: {
                title: parent.title || '',
                firstName: parent.firstName,
                lastName: parent.lastName,
                relationship: parent.relationship || '',
                phone: parent.phone,
                email: parent.email,
                address: parent.address,
                occupation: parent.occupation || '',
                username: parent.user?.username || '',
                registrationDate: parent.registrationDate
            },
            consentStatement,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Verify a parent onboarding verification JWT (used by the /register endpoint).
     * Returns decoded { tokenId, phone } or throws.
     */
    decodeVerificationToken(token: string): { tokenId: number; phone: string } {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            if (decoded.type !== 'PARENT_ONBOARDING') {
                throw new AppError('Invalid verification token', 403, 'Forbidden');
            }
            return { tokenId: decoded.tokenId, phone: decoded.phone };
        } catch (err: any) {
            if (err instanceof AppError) throw err;
            throw new AppError('Verification token is invalid or has expired', 403, 'Forbidden');
        }
    }
}

export const parentOnboardingService = new ParentOnboardingService();
