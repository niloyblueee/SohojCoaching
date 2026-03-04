import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
};

// GET /api/batches: List all batches
app.get('/api/batches', async (_req, res) => {
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

// GET /api/students: List all students
app.get('/api/students', async (_req, res) => {
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

// GET /api/teachers: List all teachers
app.get('/api/teachers', async (_req, res) => {
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

// GET /api/students/:studentId/batches: list batches where student is actively enrolled
app.get('/api/students/:studentId/batches', async (req, res) => {
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

// POST /api/study-materials: store metadata first in Postgres (FR-19)
app.post('/api/study-materials', async (req, res) => {
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

// GET /api/study-materials?batch_id=...&search=...
app.get('/api/study-materials', async (req, res) => {
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
          select: { id: true, name: true, email: true }
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
// Student can only view materials for their actively enrolled batches
app.get('/api/students/:studentId/materials', async (req, res) => {
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

// DELETE /api/study-materials/:id
app.delete('/api/study-materials/:id', async (req, res) => {
  const { id } = req.params;

  if (!isUuid(id)) {
    return res.status(400).json({ error: 'Invalid UUID for material id.' });
  }

  try {
    await prisma.studyMaterial.delete({
      where: { id }
    });
    res.json({ message: 'Study material deleted.' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Study material not found.' });
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/enrollments: Enroll a student into a batch
app.post('/api/enrollments', async (req, res) => {
  const { student_id, batch_id } = req.body;
  try {
    // Check if batch exists
    const batchExists = await prisma.batch.findUnique({ where: { id: batch_id } });
    if (!batchExists) return res.status(404).json({ error: 'Batch not found' });

    // Insert enrollment
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

// DELETE /api/enrollments/:id: Soft delete (drop) an enrollment
app.delete('/api/enrollments/:id', async (req, res) => {
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

// POST /api/assignments: Assign a teacher to a batch
app.post('/api/assignments', async (req, res) => {
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

// DELETE /api/assignments/:id: Remove a teacher from a batch
app.delete('/api/assignments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deletedAssignment = await prisma.teacherAssignment.delete({
      where: { id }
    });
    res.json({ message: 'Teacher assignment removed.', deletedAssignment });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/batches/:batchId/members: Get members (students & teachers)
app.get('/api/batches/:batchId/members', async (req, res) => {
  const { batchId } = req.params;
  try {
    // Get active enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: { batchId: batchId, status: 'active' },
      include: { student: true }
    });
    
    // Get teacher assignments
    const assignments = await prisma.teacherAssignment.findMany({
      where: { batchId: batchId },
      include: { teacher: true }
    });

    res.json({
      students: enrollments.map(e => ({ 
        enrollmentId: e.id,
        studentId: e.student.id, 
        name: e.student.name, 
        status: e.status 
      })),
      teachers: assignments.map(a => ({ 
        assignmentId: a.id,
        teacherId: a.teacher.id, 
        name: a.teacher.name, 
        role: a.role 
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Check Database connection before starting server
    await prisma.$connect();
    console.log('✅ Successfully connected to the database.');
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Update PORT in .env or stop the running process.`);
      } else {
        console.error('❌ Server startup error:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to connect to the database. Exiting...', error);
    process.exit(1);
  }
}

startServer();