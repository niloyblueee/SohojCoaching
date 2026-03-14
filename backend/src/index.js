import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'sohojcoaching-dev-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const ADMIN_ACCOUNTS = [
  {
    id: 'admin-001',
    name: 'Admin One',
    email: 'admin1@sohojcoaching.com',
    password: 'Admin123!'
  },
  {
    id: 'admin-002',
    name: 'Admin Two',
    email: 'admin2@sohojcoaching.com',
    password: 'Admin123!'
  },
  {
    id: 'admin-003',
    name: 'Admin Three',
    email: 'admin3@sohojcoaching.com',
    password: 'Admin123!'
  }
];

const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
};

const issueToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
};

const requireAuth = (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Authorization token is required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.auth || req.auth.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { role, email, password } = req.body;

  if (!role || !email || !password) {
    return res.status(400).json({ error: 'role, email, and password are required.' });
  }

  if (String(role).toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'JWT login is currently enabled for admin accounts only.' });
  }

  const admin = ADMIN_ACCOUNTS.find(
    (account) => account.email.toLowerCase() === String(email).toLowerCase() && account.password === String(password)
  );

  if (!admin) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  const user = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: 'admin'
  };

  const token = issueToken(user);

  res.json({
    token,
    user,
    redirectTo: '/admin/management'
  });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.auth.sub,
      name: req.auth.name,
      email: req.auth.email,
      role: req.auth.role
    }
  });
});

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
app.post('/api/study-materials', requireAuth, requireAdmin, async (req, res) => {
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
app.delete('/api/study-materials/:id', requireAuth, requireAdmin, async (req, res) => {
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
app.post('/api/enrollments', requireAuth, requireAdmin, async (req, res) => {
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
app.delete('/api/enrollments/:id', requireAuth, requireAdmin, async (req, res) => {
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
app.post('/api/assignments', requireAuth, requireAdmin, async (req, res) => {
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
app.delete('/api/assignments/:id', requireAuth, requireAdmin, async (req, res) => {
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
app.get('/api/batches/:batchId/members', requireAuth, requireAdmin, async (req, res) => {
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

// ─── FR-17 / FR-18: Exam Script Management ───────────────────────────────────

// POST /api/student-scripts
// Teacher saves a graded script for a specific student in a batch.
// Only PDF is accepted; the blob is stored in the client's IndexedDB using the returned id.
app.post('/api/student-scripts', requireAuth, requireAdmin, async (req, res) => {
  const { student_id, batch_id, exam_name, uploaded_by } = req.body;

  if (!isUuid(student_id) || !isUuid(batch_id) || !isUuid(uploaded_by)) {
    return res.status(400).json({ error: 'student_id, batch_id, and uploaded_by must be valid UUIDs.' });
  }

  if (!exam_name || !String(exam_name).trim()) {
    return res.status(400).json({ error: 'exam_name is required.' });
  }

  try {
    // Verify uploader is a teacher
    const uploader = await prisma.user.findUnique({
      where: { id: uploaded_by },
      select: { id: true, role: true }
    });
    if (!uploader) return res.status(404).json({ error: 'Uploader not found.' });
    if (String(uploader.role).toLowerCase() !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can upload exam scripts.' });
    }

    // Verify target user is a student
    const student = await prisma.user.findUnique({
      where: { id: student_id },
      select: { id: true, role: true }
    });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (String(student.role).toLowerCase() !== 'student') {
      return res.status(400).json({ error: 'Target user is not a student.' });
    }

    // Verify the student is actively enrolled in the batch (FR-17)
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
        id: true, studentId: true, batchId: true, examName: true,
        fileType: true, storageUrl: true, uploadedAt: true, uploadedBy: true
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

// GET /api/student-scripts
// Two modes:
//   ?student_id=<uuid>  → FR-18: student-scoped query; only returns that student's own scripts.
//   ?batch_id=<uuid>    → Teacher view: all scripts for a batch (no student restriction).
// At least one parameter is required so that the endpoint never returns the full dataset.
app.get('/api/student-scripts', async (req, res) => {
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
    // FR-18: when querying by student_id, confirm the user is actually a student
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

    res.json(scripts.map((s) => ({
      id: s.id,
      student_id: s.studentId,
      batch_id: s.batchId,
      exam_name: s.examName,
      file_type: s.fileType,
      storage_url: s.storageUrl,
      uploaded_at: s.uploadedAt,
      uploaded_by: s.uploadedBy,
      student: s.student,
      batch: s.batch,
      uploader: s.uploader
    })));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DELETE /api/student-scripts/:id
// Teachers can remove a script record from Postgres.
// The client is responsible for also removing the blob from IndexedDB.
app.delete('/api/student-scripts/:id', requireAuth, requireAdmin, async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────

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