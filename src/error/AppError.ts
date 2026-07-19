export class AppError extends Error {
    status: number;
    error: string;

    constructor(message: string, status: number = 400, errorName: string = 'Bad Request') {
        super(message);
        this.status = status;
        this.error = errorName;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
