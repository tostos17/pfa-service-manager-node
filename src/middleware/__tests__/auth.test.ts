import { authenticateJwt, requireRoles, AuthenticatedRequest } from '../auth';
import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';

jest.mock('jsonwebtoken');

describe('auth middleware unit tests', () => {
    let mockRequest: Partial<AuthenticatedRequest>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
        mockRequest = {
            headers: {},
            query: {}
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        nextFunction = jest.fn();
        jest.clearAllMocks();
    });

    describe('authenticateJwt', () => {
        test('returns 401 if no authorization header or query token', () => {
            authenticateJwt(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);
            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false, error: 'Unauthorized' })
            );
            expect(nextFunction).not.toHaveBeenCalled();
        });

        test('calls next() if authorization header contains a valid token', () => {
            const mockUserPayload = { id: 10, username: 'admin', roles: ['ROLE_ADMIN'] };
            mockRequest.headers = { authorization: 'Bearer validtoken' };
            (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload);

            authenticateJwt(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

            expect(jwt.verify).toHaveBeenCalledWith('validtoken', expect.any(String));
            expect(mockRequest.user).toEqual(mockUserPayload);
            expect(nextFunction).toHaveBeenCalled();
        });

        test('calls next() if query parameter contains a valid token', () => {
            const mockUserPayload = { id: 30, username: 'parent', roles: ['ROLE_PARENT'] };
            mockRequest.query = { token: 'validquerytoken' };
            (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload);

            authenticateJwt(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

            expect(jwt.verify).toHaveBeenCalledWith('validquerytoken', expect.any(String));
            expect(mockRequest.user).toEqual(mockUserPayload);
            expect(nextFunction).toHaveBeenCalled();
        });

        test('returns 403 if token is invalid', () => {
            mockRequest.headers = { authorization: 'Bearer invalidtoken' };
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('invalid signature');
            });

            authenticateJwt(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(nextFunction).not.toHaveBeenCalled();
        });
    });

    describe('requireRoles', () => {
        test('returns 401 if user is not set on request', () => {
            const middleware = requireRoles(['ADMIN']);
            middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(nextFunction).not.toHaveBeenCalled();
        });

        test('calls next() if user has the allowed role', () => {
            mockRequest.user = { id: 10, username: 'admin', roles: ['ROLE_ADMIN'] };
            const middleware = requireRoles(['ADMIN']);

            middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        test('calls next() if user has a matching role with differing case or prefix', () => {
            mockRequest.user = { id: 20, username: 'coach', roles: ['role_coach'] };
            const middleware = requireRoles(['COACH']);

            middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        test('returns 403 if user does not have the allowed roles', () => {
            mockRequest.user = { id: 30, username: 'parent', roles: ['ROLE_PARENT'] };
            const middleware = requireRoles(['ADMIN', 'DIRECTOR']);

            middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(nextFunction).not.toHaveBeenCalled();
        });
    });
});
