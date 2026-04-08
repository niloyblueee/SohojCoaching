import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MAX_SEED_BATCHES = 4;
const MAX_SEED_STUDENTS = 12;
const SESSION_COUNT = 18;
const SESSION_GAP_DAYS = 2;

const formatDate = (value) => value.toISOString().slice(0, 10);

const buildSessionDates = () => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = SESSION_COUNT - 1; i >= 0; i -= 1) {
        const next = new Date(today);
        next.setDate(today.getDate() - i * SESSION_GAP_DAYS);
        dates.push(formatDate(next));
    }

    return dates;
};

const pickStatus = ({ batchIndex, studentIndex, sessionIndex }) => {
    const score = (batchIndex * 11 + studentIndex * 7 + sessionIndex * 13) % 100;

    if (score < 72) return 'present';
    if (score < 87) return 'absent';
    if (score < 96) return 'late';
    return 'excused';
};

const ensureAttendanceSchema = async () => {
    const tableCheck = await prisma.$queryRaw`
        SELECT
            to_regclass('public.attendance_sessions') IS NOT NULL AS has_sessions,
            to_regclass('public.attendance_records') IS NOT NULL AS has_records
    `;

    const hasSessions = Boolean(tableCheck[0]?.has_sessions);
    const hasRecords = Boolean(tableCheck[0]?.has_records);

    if (!hasSessions || !hasRecords) {
        throw new Error(
            'Attendance tables are missing. Run sql/20260408_fr12_attendance_analytics.sql or npm run db:push first.'
        );
    }
};

const listSeedTargets = async () => {
    const [teachers, students, batches] = await Promise.all([
        prisma.$queryRaw`
            SELECT id, name, email
            FROM users
            WHERE LOWER(role) = 'teacher'
            ORDER BY name ASC
        `,
        prisma.$queryRaw`
            SELECT id, name, email
            FROM users
            WHERE LOWER(role) = 'student'
            ORDER BY name ASC
            LIMIT ${MAX_SEED_STUDENTS}
        `,
        prisma.$queryRaw`
            SELECT id,
                   COALESCE(NULLIF(batch_name, ''), name) AS batch_name,
                   COALESCE(NULLIF(subject, ''), course) AS course
            FROM batches
            ORDER BY batch_name ASC
            LIMIT ${MAX_SEED_BATCHES}
        `
    ]);

    return {
        teachers,
        students,
        batches
    };
};

const ensureTeacherAssignments = async (teachers, batches) => {
    for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];
        const teacher = teachers[i % teachers.length];

        await prisma.$executeRaw`
            UPDATE batches
            SET teacher_id = COALESCE(teacher_id, ${teacher.id}::uuid)
            WHERE id = ${batch.id}::uuid
        `;

        await prisma.$executeRaw`
            INSERT INTO teacher_assignments (id, teacher_id, batch_id, role, assigned_at)
            SELECT
                ${randomUUID()}::uuid,
                ${teacher.id}::uuid,
                ${batch.id}::uuid,
                'Lead',
                NOW()
            WHERE NOT EXISTS (
                SELECT 1
                FROM teacher_assignments ta
                WHERE ta.teacher_id = ${teacher.id}::uuid
                  AND ta.batch_id = ${batch.id}::uuid
            )
        `;
    }
};

const ensureEnrollments = async (students, batches) => {
    for (const student of students) {
        for (const batch of batches) {
            await prisma.$executeRaw`
                INSERT INTO enrollments (id, student_id, batch_id, status, enrolled_at)
                VALUES (
                    ${randomUUID()}::uuid,
                    ${student.id}::uuid,
                    ${batch.id}::uuid,
                    'active',
                    NOW()
                )
                ON CONFLICT (student_id, batch_id)
                DO UPDATE SET status = 'active'
            `;
        }
    }
};

const listBatchStudents = async (batchId) => {
    const rows = await prisma.$queryRaw`
        SELECT e.student_id
        FROM enrollments e
        WHERE e.batch_id = ${batchId}::uuid
          AND LOWER(e.status::text) = 'active'
        ORDER BY e.student_id ASC
    `;

    return rows.map((row) => row.student_id);
};

const seedAttendanceRecords = async ({ teachers, batches }) => {
    const sessionDates = buildSessionDates();
    let totalSessions = 0;
    let totalRecords = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex];
        const teacher = teachers[batchIndex % teachers.length];
        const studentIds = await listBatchStudents(batch.id);

        if (!studentIds.length) continue;

        for (let sessionIndex = 0; sessionIndex < sessionDates.length; sessionIndex += 1) {
            const sessionDate = sessionDates[sessionIndex];
            const topic = `Week ${sessionIndex + 1} Session`;

            const insertedSessions = await prisma.$queryRaw`
                INSERT INTO attendance_sessions (id, batch_id, session_date, topic, created_by, created_at)
                VALUES (
                    ${randomUUID()}::uuid,
                    ${batch.id}::uuid,
                    ${sessionDate}::date,
                    ${topic},
                    ${teacher.id}::uuid,
                    NOW()
                )
                ON CONFLICT (batch_id, session_date)
                DO UPDATE SET topic = EXCLUDED.topic
                RETURNING id
            `;

            const sessionId = insertedSessions[0]?.id;
            if (!sessionId) continue;

            totalSessions += 1;

            for (let studentIndex = 0; studentIndex < studentIds.length; studentIndex += 1) {
                const studentId = studentIds[studentIndex];
                const status = pickStatus({ batchIndex, studentIndex, sessionIndex });
                const note = status === 'excused' ? 'Parent informed before class.' : null;

                await prisma.$executeRaw`
                    INSERT INTO attendance_records (
                        id,
                        session_id,
                        student_id,
                        status,
                        note,
                        marked_at,
                        marked_by
                    )
                    VALUES (
                        ${randomUUID()}::uuid,
                        ${sessionId}::uuid,
                        ${studentId}::uuid,
                        ${status}::attendance_status,
                        ${note},
                        NOW(),
                        ${teacher.id}::uuid
                    )
                    ON CONFLICT (session_id, student_id)
                    DO UPDATE SET
                        status = EXCLUDED.status,
                        note = EXCLUDED.note,
                        marked_at = NOW(),
                        marked_by = EXCLUDED.marked_by
                `;

                totalRecords += 1;
            }
        }
    }

    return { totalSessions, totalRecords };
};

async function main() {
    await ensureAttendanceSchema();

    const { teachers, students, batches } = await listSeedTargets();

    if (!teachers.length) {
        throw new Error('No teacher accounts found. Create at least one teacher before seeding attendance.');
    }

    if (!students.length) {
        throw new Error('No student accounts found. Create at least one student before seeding attendance.');
    }

    if (!batches.length) {
        throw new Error('No batches found. Create at least one batch before seeding attendance.');
    }

    await ensureTeacherAssignments(teachers, batches);
    await ensureEnrollments(students, batches);
    const stats = await seedAttendanceRecords({ teachers, batches });

    console.log('Attendance analytics seed complete.');
    console.log(`Teachers used: ${teachers.length}`);
    console.log(`Students used: ${students.length}`);
    console.log(`Batches used: ${batches.length}`);
    console.log(`Sessions upserted: ${stats.totalSessions}`);
    console.log(`Attendance rows upserted: ${stats.totalRecords}`);
}

main()
    .catch((error) => {
        console.error('Attendance seed failed:', error.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
