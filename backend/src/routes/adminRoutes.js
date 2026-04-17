import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAdmin, requireAnyRole, requireAuth } from '../middleware/auth.js';
import { isUuid } from '../utils/validators.js';

export const createAdminRoutes = (prisma) => {
    const adminRoutes = Router();
    adminRoutes.use(requireAuth);

    // POST /api/study-materials
    adminRoutes.post('/study-materials', requireAnyRole(['admin', 'teacher']), async (req, res) => {
        const { batch_id, file_name, file_type, uploaded_by } = req.body;

        if (!isUuid(batch_id) || !isUuid(uploaded_by)) {
            return res.status(400).json({ error: 'batch_id and uploaded_by must be valid UUIDs.' });
        }

        if (!file_name || !file_type) {
            return res.status(400).json({ error: 'file_name and file_type are required.' });
        }

        const id = randomUUID();
        const storageUrl = `idb-proxy://study-materials/${id}`;

        try {
            const uploader = await prisma.user.findUnique({
                where: { id: uploaded_by },
                select: { id: true, role: true }
            });

            if (!uploader) {
                return res.status(404).json({ error: 'Uploader not found in users table.' });
            }

            if (String(uploader.role).toLowerCase() !== 'teacher') {
                return res.status(403).json({ error: 'Only users with teacher role can upload materials.' });
            }

            const material = await prisma.studyMaterial.create({
                data: {
                    id,
                    batchId: batch_id,
                    fileName: file_name,
                    fileType: file_type,
                    storageUrl,
                    uploadedBy: uploaded_by
                },
                select: {
                    id: true,
                    batchId: true,
                    fileName: true,
                    fileType: true,
                    storageUrl: true,
                    uploadedAt: true,
                    uploadedBy: true
                }
            });

            res.status(201).json({
                id: material.id,
                batch_id: material.batchId,
                file_name: material.fileName,
                file_type: material.fileType,
                storage_url: material.storageUrl,
                uploaded_at: material.uploadedAt,
                uploaded_by: material.uploadedBy
            });
        } catch (error) {
            if (error.code === 'P2003') {
                return res.status(400).json({ error: 'Invalid batch_id or uploaded_by (Foreign Key violation).' });
            }
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // DELETE /api/study-materials/:id
    adminRoutes.delete('/study-materials/:id', requireAnyRole(['admin', 'teacher']), async (req, res) => {
        const { id } = req.params;

        if (!isUuid(id)) {
            return res.status(400).json({ error: 'Invalid UUID for material id.' });
        }

        try {
            await prisma.studyMaterial.delete({ where: { id } });
            res.json({ message: 'Study material deleted.' });
        } catch (error) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Study material not found.' });
            }
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // POST /api/enrollments
    adminRoutes.post('/enrollments', requireAdmin, async (req, res) => {
        const { student_id, batch_id } = req.body;
        try {
            const batchExists = await prisma.batch.findUnique({ where: { id: batch_id } });
            if (!batchExists) return res.status(404).json({ error: 'Batch not found' });

            const enrollment = await prisma.enrollment.create({
                data: {
                    studentId: student_id,
                    batchId: batch_id,
                    status: 'active'
                }
            });
            res.status(201).json(enrollment);
        } catch (error) {
            if (error.code === 'P2002') return res.status(409).json({ error: 'Student is already enrolled in this batch.' });
            if (error.code === 'P2003') return res.status(400).json({ error: 'Invalid student or batch ID (Foreign Key violation).' });
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // DELETE /api/enrollments/:id
    adminRoutes.delete('/enrollments/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        try {
            const enrollment = await prisma.enrollment.update({
                where: { id },
                data: { status: 'dropped' }
            });
            res.json(enrollment);
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Enrollment not found.' });
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // POST /api/assignments
    adminRoutes.post('/assignments', requireAdmin, async (req, res) => {
        const { teacher_id, batch_id, role } = req.body;
        try {
            const assignment = await prisma.teacherAssignment.create({
                data: {
                    teacherId: teacher_id,
                    batchId: batch_id,
                    role
                }
            });
            res.status(201).json(assignment);
        } catch (error) {
            if (error.code === 'P2003') return res.status(400).json({ error: 'Invalid teacher or batch ID (Foreign Key violation).' });
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // DELETE /api/assignments/:id
    adminRoutes.delete('/assignments/:id', requireAdmin, async (req, res) => {
        const { id } = req.params;
        try {
            const deletedAssignment = await prisma.teacherAssignment.delete({ where: { id } });
            res.json({ message: 'Teacher assignment removed.', deletedAssignment });
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // GET /api/batch-overview
    adminRoutes.get('/batch-overview', requireAdmin, async (_req, res) => {
        try {
            const rows = await prisma.$queryRaw`
                SELECT
                    b.id,
                    COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,
                    COALESCE(NULLIF(b.subject, ''), b.course) AS course,
                    (
                        SELECT COUNT(*)::int
                        FROM enrollments e
                        WHERE e.batch_id = b.id
                          AND LOWER(e.status::text) = 'active'
                    ) AS total_students,
                    (
                        SELECT COUNT(ar.id)::int
                        FROM attendance_records ar
                        JOIN attendance_sessions s ON s.id = ar.session_id
                        WHERE s.batch_id = b.id
                    ) AS total_marks,
                    (
                        SELECT COALESCE(SUM(CASE WHEN ar.status::text IN ('present', 'late') THEN 1 ELSE 0 END), 0)::int
                        FROM attendance_records ar
                        JOIN attendance_sessions s ON s.id = ar.session_id
                        WHERE s.batch_id = b.id
                    ) AS attended_marks
                FROM batches b
                ORDER BY batch_name ASC
            `;

            const normalized = rows.map((row) => {
                const totalMarks = Number(row.total_marks || 0);
                const attendedMarks = Number(row.attended_marks || 0);
                const attendanceRate = totalMarks > 0 ? Number(((attendedMarks / totalMarks) * 100).toFixed(2)) : 0;

                return {
                    id: row.id,
                    batch_name: row.batch_name,
                    course: row.course,
                    total_students: Number(row.total_students || 0),
                    attendance_rate: attendanceRate,
                    fee_status: 'Pending Integration',
                    total_marks: totalMarks,
                    attended_marks: attendedMarks
                };
            });

            const summary = normalized.reduce(
                (acc, batch) => {
                    acc.total_batches += 1;
                    acc.total_students += batch.total_students;
                    acc.total_marks += batch.total_marks;
                    acc.attended_marks += batch.attended_marks;
                    return acc;
                },
                { total_batches: 0, total_students: 0, total_marks: 0, attended_marks: 0 }
            );

            const overall_attendance_rate =
                summary.total_marks > 0
                    ? Number(((summary.attended_marks / summary.total_marks) * 100).toFixed(2))
                    : 0;

            return res.json({
                generated_at: new Date().toISOString(),
                summary: {
                    total_batches: summary.total_batches,
                    total_students: summary.total_students,
                    overall_attendance_rate
                },
                batches: normalized
            });
        } catch (error) {
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // GET /api/batches/:batchId/members
    adminRoutes.get('/batches/:batchId/members', requireAnyRole(['admin', 'teacher']), async (req, res) => {
        const { batchId } = req.params;
        try {
            const enrollments = await prisma.enrollment.findMany({
                where: { batchId, status: 'active' },
                include: { student: true }
            });

            const assignments = await prisma.teacherAssignment.findMany({
                where: { batchId },
                include: { teacher: true }
            });

            res.json({
                students: enrollments.map((enrollment) => ({
                    enrollmentId: enrollment.id,
                    studentId: enrollment.student.id,
                    name: enrollment.student.name,
                    status: enrollment.status
                })),
                teachers: assignments.map((assignment) => ({
                    assignmentId: assignment.id,
                    teacherId: assignment.teacher.id,
                    name: assignment.teacher.name,
                    role: assignment.role
                }))
            });
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // POST /api/student-scripts
    adminRoutes.post('/student-scripts', requireAnyRole(['admin', 'teacher']), async (req, res) => {
        const { student_id, batch_id, exam_name, uploaded_by } = req.body;

        if (!isUuid(student_id) || !isUuid(batch_id) || !isUuid(uploaded_by)) {
            return res.status(400).json({ error: 'student_id, batch_id, and uploaded_by must be valid UUIDs.' });
        }

        if (!exam_name || !String(exam_name).trim()) {
            return res.status(400).json({ error: 'exam_name is required.' });
        }

        try {
            const uploader = await prisma.user.findUnique({
                where: { id: uploaded_by },
                select: { id: true, role: true }
            });
            if (!uploader) return res.status(404).json({ error: 'Uploader not found.' });
            if (String(uploader.role).toLowerCase() !== 'teacher') {
                return res.status(403).json({ error: 'Only teachers can upload exam scripts.' });
            }

            const student = await prisma.user.findUnique({
                where: { id: student_id },
                select: { id: true, role: true }
            });
            if (!student) return res.status(404).json({ error: 'Student not found.' });
            if (String(student.role).toLowerCase() !== 'student') {
                return res.status(400).json({ error: 'Target user is not a student.' });
            }

            const enrollment = await prisma.enrollment.findFirst({
                where: { studentId: student_id, batchId: batch_id, status: 'active' },
                select: { id: true }
            });
            if (!enrollment) {
                return res.status(403).json({ error: 'Student is not actively enrolled in the specified batch.' });
            }

            const id = randomUUID();
            const storageUrl = `idb-proxy://student-scripts/${id}`;

            const script = await prisma.studentScript.create({
                data: {
                    id,
                    studentId: student_id,
                    batchId: batch_id,
                    examName: String(exam_name).trim(),
                    fileType: 'application/pdf',
                    storageUrl,
                    uploadedBy: uploaded_by
                },
                select: {
                    id: true,
                    studentId: true,
                    batchId: true,
                    examName: true,
                    fileType: true,
                    storageUrl: true,
                    uploadedAt: true,
                    uploadedBy: true
                }
            });

            res.status(201).json({
                id: script.id,
                student_id: script.studentId,
                batch_id: script.batchId,
                exam_name: script.examName,
                file_type: script.fileType,
                storage_url: script.storageUrl,
                uploaded_at: script.uploadedAt,
                uploaded_by: script.uploadedBy
            });
        } catch (error) {
            if (error.code === 'P2003') return res.status(400).json({ error: 'Invalid FK: student_id, batch_id, or uploaded_by.' });
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // DELETE /api/student-scripts/:id
    adminRoutes.delete('/student-scripts/:id', requireAnyRole(['admin', 'teacher']), async (req, res) => {
        const { id } = req.params;

        if (!isUuid(id)) {
            return res.status(400).json({ error: 'Invalid UUID for script id.' });
        }

        try {
            await prisma.studentScript.delete({ where: { id } });
            res.json({ message: 'Script deleted.' });
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Script not found.' });
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // --- Add these inside createAdminRoutes(prisma) ---

    // GET /api/studentProfile
    adminRoutes.get('/studentProfile', requireAdmin, async (req, res) => {
        try {
            const students = await prisma.$queryRaw`SELECT * FROM users WHERE LOWER(role) = 'student' ORDER BY name ASC`;
            res.json(students);
        } catch (err) {
            res.status(500).json({ error: 'Internal server error', details: err.message });
        }
    });

    // PUT /api/studentProfile/:id
    adminRoutes.put('/studentProfile/:id', requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, email } = req.body;
            await prisma.$executeRaw`
                UPDATE users 
                SET name = ${name}, email = ${email} 
                WHERE id = ${id}::uuid AND LOWER(role) = 'student'
            `;
            res.json({ message: "Profile updated successfully!" });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error', details: err.message });
        }
    });

    // PUT /api/studentProfile/:id/status
    adminRoutes.put('/studentProfile/:id/status', requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            await prisma.$executeRaw`
                UPDATE users 
                SET status = ${status} 
                WHERE id = ${id}::uuid AND LOWER(role) = 'student'
            `;
            res.json({ message: "Status updated successfully!" });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error', details: err.message });
        }
    });
    return adminRoutes;
};
