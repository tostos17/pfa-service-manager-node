import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    const status = err.status || 500;
    const errorName = err.error || 'Internal Server Error';
    const message = err.message || 'An unexpected error occurred on the server';

    return res.status(status).json({
        status,
        error: errorName,
        message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        validationErrors: err.validationErrors || null
    });
};
