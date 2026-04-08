import { Router } from 'express';
import { requireAnyRole, requireAuth } from '../middleware/auth.js';
import { isUuid } from '../utils/validators.js';
import {
    getStudentAttendanceAnalytics,
    getTeacherAttendanceAnalytics
} from '../services/attendanceService.js';

const parseLookbackDays = (value) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed)) return 60;
    return parsed;
};

export const createAttendanceRoutes = (prisma) => {
    const router = Router();
    router.use(requireAuth);

    router.get('/attendance/teacher/analytics', requireAnyRole(['teacher', 'admin']), async (req, res) => {
        const { batch_id, student_id, days } = req.query;

        if (batch_id && !isUuid(batch_id)) {
            return res.status(400).json({ error: 'batch_id must be a valid UUID.' });
        }

        if (student_id && !isUuid(student_id)) {
            return res.status(400).json({ error: 'student_id must be a valid UUID.' });
        }

        try {
            const payload = await getTeacherAttendanceAnalytics(prisma, {
                requesterId: req.auth.sub,
                requesterRole: req.auth.role,
                batchId: batch_id ? String(batch_id) : null,
                studentId: student_id ? String(student_id) : null,
                lookbackDays: parseLookbackDays(days)
            });

            return res.json(payload);
        } catch (error) {
            const statusCode = error.statusCode || 500;
            return res.status(statusCode).json({
                error: error.message || 'Internal server error',
                details: statusCode === 500 ? error.message : undefined
            });
        }
    });

    router.get('/attendance/student/analytics', requireAnyRole(['student']), async (req, res) => {
        const { batch_id, days } = req.query;

        if (batch_id && !isUuid(batch_id)) {
            return res.status(400).json({ error: 'batch_id must be a valid UUID.' });
        }

        try {
            const payload = await getStudentAttendanceAnalytics(prisma, {
                studentId: req.auth.sub,
                batchId: batch_id ? String(batch_id) : null,
                lookbackDays: parseLookbackDays(days)
            });

            return res.json(payload);
        } catch (error) {
            const statusCode = error.statusCode || 500;
            return res.status(statusCode).json({
                error: error.message || 'Internal server error',
                details: statusCode === 500 ? error.message : undefined
            });
        }
    });

    return router;
};
