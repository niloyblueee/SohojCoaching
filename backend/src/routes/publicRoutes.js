import { Router } from 'express';
import { isUuid } from '../utils/validators.js';

export const createPublicRoutes = (prisma) => {
    const publicRoutes = Router();
    // GET /api/batches
    publicRoutes.get('/batches', async (_req, res) => {
        try {
            const batches = await prisma.batch.findMany({
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    course: true
                }
            });
            res.json(batches);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // GET /api/students
    publicRoutes.get('/students', async (_req, res) => {
        try {
            const students = await prisma.user.findMany({
                where: { role: { equals: 'student', mode: 'insensitive' } },
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            });
            res.json(students);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // GET /api/teachers
    publicRoutes.get('/teachers', async (_req, res) => {
        try {
            const teachers = await prisma.user.findMany({
                where: { role: { equals: 'teacher', mode: 'insensitive' } },
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            });
            res.json(teachers);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // GET /api/students/:studentId/batches
    publicRoutes.get('/students/:studentId/batches', async (req, res) => {
        const { studentId } = req.params;

        if (!isUuid(studentId)) {
            return res.status(400).json({ error: 'Invalid UUID for studentId.' });
        }

        try {
            const enrollments = await prisma.enrollment.findMany({
                where: {
                    studentId,
                    status: 'active'
                },
                include: {
                    batch: {
                        select: {
                            id: true,
                            name: true,
                            course: true
                        }
                    }
                },
                orderBy: {
                    enrolledAt: 'desc'
                }
            });

            res.json(enrollments.map((enrollment) => enrollment.batch));
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // GET /api/study-materials?batch_id=...&search=...
    publicRoutes.get('/study-materials', async (req, res) => {
        const { batch_id, search } = req.query;

        const where = {};

        if (batch_id) {
            if (!isUuid(batch_id)) {
                return res.status(400).json({ error: 'Invalid UUID for batch_id.' });
            }
            where.batchId = batch_id;
        }

        if (search && String(search).trim()) {
            where.fileName = {
                contains: String(search).trim(),
                mode: 'insensitive'
            };
        }

        try {
            const materials = await prisma.studyMaterial.findMany({
                where,
                include: {
                    batch: {
                        select: { id: true, name: true }
                    },
                    uploader: {
                        select: { id: true, name: true, email: true, role: true }
                    }
                },
                orderBy: {
                    uploadedAt: 'desc'
                }
            });

            res.json(
                materials.map((material) => ({
                    id: material.id,
                    batch_id: material.batchId,
                    file_name: material.fileName,
                    file_type: material.fileType,
                    storage_url: material.storageUrl,
                    uploaded_at: material.uploadedAt,
                    uploaded_by: material.uploadedBy,
                    batch: material.batch,
                    uploader: material.uploader
                        ? {
                            id: material.uploader.id,
                            name: String(material.uploader.role).toLowerCase() === 'teacher' ? material.uploader.name : 'Former Teacher',
                            email: material.uploader.email,
                            role: material.uploader.role
                        }
                        : { name: 'Former Teacher', role: 'unknown' }
                }))
            );
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // GET /api/students/:studentId/materials?batch_id=...&search=...
    publicRoutes.get('/students/:studentId/materials', async (req, res) => {
        const { studentId } = req.params;
        const { batch_id, search } = req.query;

        if (!isUuid(studentId)) {
            return res.status(400).json({ error: 'Invalid UUID for studentId.' });
        }

        if (!batch_id || !isUuid(batch_id)) {
            return res.status(400).json({ error: 'batch_id is required and must be a valid UUID.' });
        }

        try {
            const student = await prisma.user.findUnique({
                where: { id: studentId },
                select: { id: true, role: true }
            });

            if (!student) {
                return res.status(404).json({ error: 'Student not found in users table.' });
            }

            if (String(student.role).toLowerCase() !== 'student') {
                return res.status(403).json({ error: 'Only users with student role can access student materials.' });
            }

            const activeEnrollment = await prisma.enrollment.findFirst({
                where: {
                    studentId,
                    batchId: String(batch_id),
                    status: 'active'
                },
                select: { id: true }
            });

            if (!activeEnrollment) {
                return res.status(403).json({ error: 'Student is not actively enrolled in the requested batch.' });
            }

            const where = {
                batchId: String(batch_id)
            };

            if (search && String(search).trim()) {
                where.fileName = {
                    contains: String(search).trim(),
                    mode: 'insensitive'
                };
            }

            const materials = await prisma.studyMaterial.findMany({
                where,
                include: {
                    batch: {
                        select: { id: true, name: true }
                    },
                    uploader: {
                        select: { id: true, name: true, email: true, role: true }
                    }
                },
                orderBy: {
                    uploadedAt: 'desc'
                }
            });

            res.json(
                materials.map((material) => ({
                    id: material.id,
                    batch_id: material.batchId,
                    file_name: material.fileName,
                    file_type: material.fileType,
                    storage_url: material.storageUrl,
                    uploaded_at: material.uploadedAt,
                    uploaded_by: material.uploadedBy,
                    batch: material.batch,
                    uploader: material.uploader
                        ? {
                            id: material.uploader.id,
                            name: String(material.uploader.role).toLowerCase() === 'teacher' ? material.uploader.name : 'Former Teacher',
                            email: material.uploader.email,
                            role: material.uploader.role
                        }
                        : { name: 'Former Teacher', role: 'unknown' }
                }))
            );
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // GET /api/student-scripts
    publicRoutes.get('/student-scripts', async (req, res) => {
        const { student_id, batch_id } = req.query;

        if (!student_id && !batch_id) {
            return res.status(400).json({ error: 'Either student_id or batch_id must be provided.' });
        }
        if (student_id && !isUuid(student_id)) {
            return res.status(400).json({ error: 'Invalid UUID for student_id.' });
        }
        if (batch_id && !isUuid(batch_id)) {
            return res.status(400).json({ error: 'Invalid UUID for batch_id.' });
        }

        const where = {};
        if (student_id) where.studentId = student_id;
        if (batch_id) where.batchId = batch_id;

        try {
            if (student_id) {
                const student = await prisma.user.findUnique({
                    where: { id: student_id },
                    select: { id: true, role: true }
                });
                if (!student) return res.status(404).json({ error: 'Student not found.' });
                if (String(student.role).toLowerCase() !== 'student') {
                    return res.status(403).json({ error: 'Access denied: only students may query by student_id.' });
                }
            }

            const scripts = await prisma.studentScript.findMany({
                where,
                include: {
                    student: { select: { id: true, name: true } },
                    batch: { select: { id: true, name: true, course: true } },
                    uploader: { select: { id: true, name: true } }
                },
                orderBy: { uploadedAt: 'desc' }
            });

            res.json(
                scripts.map((script) => ({
                    id: script.id,
                    student_id: script.studentId,
                    batch_id: script.batchId,
                    exam_name: script.examName,
                    file_type: script.fileType,
                    storage_url: script.storageUrl,
                    uploaded_at: script.uploadedAt,
                    uploaded_by: script.uploadedBy,
                    student: script.student,
                    batch: script.batch,
                    uploader: script.uploader
                }))
            );
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    return publicRoutes;
};
