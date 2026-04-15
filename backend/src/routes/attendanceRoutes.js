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
    //To fetch the active students for a batch and attendance on a date
    router.get('/attendance/session', requireAnyRole(['teacher', 'admin']), async (req, res) => {
        const { batch_id, date } = req.query;

        if (!batch_id || !isUuid(batch_id) || !date) {
            return res.status(400).json({ error: 'batch_id (UUID) and date are required.' });
        }

        try {
            const records = await prisma.$queryRaw`
                SELECT
                    u.id AS student_id,
                    u.name AS student_name,
                    COALESCE(ar.status::text, 'absent') AS status
                FROM enrollments e
                JOIN users u ON u.id = e.student_id
                LEFT JOIN attendance_sessions s ON s.batch_id = e.batch_id AND s.session_date = ${date}::date
                LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = e.student_id
                WHERE e.batch_id = ${batch_id}::uuid AND LOWER(e.status::text) = 'active'
                ORDER BY u.name ASC
            `;
            res.json(records);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    //To Update the attendance session and records
    router.post('/attendance/session', requireAnyRole(['teacher', 'admin']), async (req, res) => {
        const { batch_id, date, records } = req.body;

        if (!batch_id || !date || !Array.isArray(records)) {
            return res.status(400).json({ error: 'batch_id, date, and records array are required.' });
        }

        const userId = req.user?.id || req.auth?.sub || req.userId || req.user?.user_id || null;

        try {
            await prisma.$transaction(async (tx) => {
                const sessionRes = await tx.$queryRaw`
                    INSERT INTO attendance_sessions (id, batch_id, session_date, created_by, created_at)
                    VALUES (gen_random_uuid(), ${batch_id}::uuid, ${date}::date, CAST(${userId} AS uuid), NOW())
                    ON CONFLICT (batch_id, session_date) DO UPDATE SET session_date = EXCLUDED.session_date
                    RETURNING id
                `;
                
                const sessionId = sessionRes[0].id;

                for (const r of records) {
                    const finalStatus = r.status === 'present' ? 'present' : 'absent';
                    
                    await tx.$executeRaw`
                        INSERT INTO attendance_records (id, session_id, student_id, status, marked_by, marked_at)
                        VALUES (
                            gen_random_uuid(), 
                            ${sessionId}::uuid, 
                            ${r.student_id}::uuid, 
                            CAST(${finalStatus} AS "AttendanceStatus"), 
                            CAST(${userId} AS uuid), 
                            NOW()
                        )
                        ON CONFLICT (session_id, student_id)
                        DO UPDATE SET 
                            status = EXCLUDED.status, 
                            marked_by = EXCLUDED.marked_by, 
                            marked_at = NOW()
                    `;
                }
            });
            res.json({ message: "Attendance saved successfully." });
        } catch (error) {
            console.error("Save Error:", error); 
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/attendance/teacher/analytics
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
