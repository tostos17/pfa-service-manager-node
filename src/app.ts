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
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
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
app.use('/api/v1', infoHubRouter);

// Global Error Handler
app.use(errorHandler);

// Database initialization & server bootup
AppDataSource.initialize()
    .then(() => {
        console.log('PostgreSQL database connection initialized successfully.');
        app.listen(PORT, () => {
            console.log(`Node.js pfa-service-manager running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Error during PostgreSQL database initialization:', err);
    });

export default app;
