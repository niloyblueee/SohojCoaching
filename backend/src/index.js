import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

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