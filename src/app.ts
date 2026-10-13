import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from './config/database';
import authRouter from './controller/AuthController';
import playerProfileRouter from './controller/PlayerProfileController';
import parentProfileRouter from './controller/ParentProfileController';
import billingRouter from './controller/BillingController';
import calendarRouter from './controller/AcademyCalendarController';
import expenseRouter from './controller/AcademyExpenseController';
import matchRouter from './controller/MatchController';
import attendanceRouter from './controller/AttendanceController';
import playerDataRouter from './controller/PlayerDataController';
import infoHubRouter from './controller/InformationHubController';
import categoryRouter from './controller/CategoryController';
import trainingRouter from './controller/TrainingController';
import portalRouter from './controller/PortalController';
import staffRouter from './controller/StaffController';
import parentOnboardingRouter from './controller/ParentOnboardingController';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Handle JSON body parsing errors (e.g. sending literal 'null' or malformed JSON) gracefully
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
        req.body = {};
        return next();
    }
    next(err);
});

app.use(express.urlencoded({ extended: true }));

// Route Mappings matching Java controller paths
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/players/profile', playerProfileRouter);
app.use('/api/v1/parents', parentProfileRouter);
app.use('/api/v1/finance', billingRouter);
app.use('/api/v1/admin/calendar', calendarRouter);
app.use('/api/v1/finance/expenses', expenseRouter);
app.use('/api/v1/matches', matchRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/players', playerDataRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/trainings', trainingRouter);
app.use('/api/v1/portal', portalRouter);
app.use('/api/v1/admin/staff', staffRouter);
app.use('/api/v1/onboarding', parentOnboardingRouter);
app.use('/api/v1', infoHubRouter);

// Global Error Handler
app.use(errorHandler);

// ─── V10 Migration: parent onboarding tokens + parent column extensions ───────
async function applyV10Migration(): Promise<void> {
    try {
        await AppDataSource.query(`
            CREATE TABLE IF NOT EXISTS parent_onboarding_tokens (
                id          BIGSERIAL PRIMARY KEY,
                phone       VARCHAR(20)  NOT NULL,
                access_key  VARCHAR(64)  NOT NULL UNIQUE,
                created_by  BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                used        BOOLEAN      NOT NULL DEFAULT FALSE,
                expires_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                created_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await AppDataSource.query(`
            CREATE INDEX IF NOT EXISTS idx_pot_phone_key
            ON parent_onboarding_tokens(phone, access_key)
        `);
        await AppDataSource.query(`
            ALTER TABLE parents ADD COLUMN IF NOT EXISTS relationship VARCHAR(50)
        `);
        await AppDataSource.query(`
            ALTER TABLE parents ADD COLUMN IF NOT EXISTS occupation VARCHAR(100)
        `);
        console.log('V10 migration applied successfully.');
    } catch (err: any) {
        console.error('V10 migration failed:', err.message);
        throw err;
    }
}

// Database initialization & server bootup
AppDataSource.initialize()
    .then(async () => {
        console.log('PostgreSQL database connection initialized successfully.');
        await applyV10Migration();
        app.listen(PORT, () => {
            console.log(`Node.js pfa-service-manager running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Error during PostgreSQL database initialization:', err);
    });

export default app;
