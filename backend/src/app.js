import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createBatchRoutes } from './routes/batchRoutes.js';
import { createPublicRoutes } from './routes/publicRoutes.js';
import { createAdminRoutes } from './routes/adminRoutes.js';
import { createAttendanceRoutes } from './routes/attendanceRoutes.js';
import { createFeeRoutes } from './routes/feeRoutes.js';
import { createQuizRoutes } from './routes/quizRoutes.js';

export const prisma = new PrismaClient();

export const createApp = () => {
    const app = express();

    app.use(cors());
    app.use(express.json({ limit: '20mb' }));
    app.use(express.urlencoded({ extended: true, limit: '20mb' }));

    app.use('/api/auth', createAuthRoutes(prisma));
    app.use('/api', createBatchRoutes(prisma));
    app.use('/api', createPublicRoutes(prisma));
    app.use('/api', createAdminRoutes(prisma));
    app.use('/api', createAttendanceRoutes(prisma));
    app.use('/api', createFeeRoutes(prisma));
    app.use('/api', createQuizRoutes(prisma));

    return app;
};
