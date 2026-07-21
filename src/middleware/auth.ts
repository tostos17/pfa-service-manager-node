import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
        roles: string[];
    };
}

export const authenticateJwt = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token as string;
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized', message: 'Missing token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkeyformigratedpfaapp') as {
            id: number;
            username: string;
            roles: string[];
        };
        req.user = decoded;
        return next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Forbidden', message: 'Invalid or expired token' });
    }
};

export const requireRoles = (allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const normalizedUserRoles = req.user.roles.map((r) => r.toUpperCase());
        const hasRole = allowedRoles.some((role) => {
            const normalized = role.toUpperCase();
            return (
                normalizedUserRoles.includes(normalized) ||
                normalizedUserRoles.includes(`ROLE_${normalized}`) ||
                normalizedUserRoles.includes(normalized.replace('ROLE_', ''))
            );
        });

        if (!hasRole) {
            return res.status(403).json({ success: false, error: 'Forbidden', message: 'Insufficient permissions' });
        }

        return next();
    };
};
