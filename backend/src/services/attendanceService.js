import { Prisma } from '@prisma/client';

const DEFAULT_LOOKBACK_DAYS = 60;
const MIN_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 180;

const asNumber = (value) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
};

const clampLookbackDays = (value) => {
    const parsed = Number.parseInt(String(value ?? DEFAULT_LOOKBACK_DAYS), 10);
    if (!Number.isFinite(parsed)) return DEFAULT_LOOKBACK_DAYS;
    return Math.min(MAX_LOOKBACK_DAYS, Math.max(MIN_LOOKBACK_DAYS, parsed));
};

const toRate = (attendedCount, totalMarks) => {
    const denominator = asNumber(totalMarks);
    if (denominator <= 0) return 0;
    return Number(((asNumber(attendedCount) / denominator) * 100).toFixed(2));
};

const inUuidSql = (columnName, uuidList) => {
    if (!uuidList?.length) {
        return Prisma.sql`FALSE`;
    }

    const safeIds = uuidList.map((value) => Prisma.sql`${value}::uuid`);
    return Prisma.sql`${Prisma.raw(columnName)} IN (${Prisma.join(safeIds)})`;
};

const normalizeBatchRows = (rows = []) => {
    return rows.map((row) => ({
        id: row.id,
        batch_name: row.batch_name,
        course: row.course
    }));
};

const normalizeStudentRows = (rows = []) => {
    return rows.map((row) => ({
        id: row.id,
        name: row.name
    }));
};

const buildSummary = (row = {}) => {
    const totalMarks = asNumber(row.total_marks);
    const attendedCount = asNumber(row.attended_count);
    const absentCount = asNumber(row.absent_count);
    const lateCount = asNumber(row.late_count);
    const totalSessions = asNumber(row.total_sessions);

    return {
        total_marks: totalMarks,
        attended_count: attendedCount,
        absent_count: absentCount,
        late_count: lateCount,
        total_sessions: totalSessions,
        attendance_rate: toRate(attendedCount, totalMarks)
    };
};

const emptySummary = () => ({
    total_marks: 0,
    attended_count: 0,
    absent_count: 0,
    late_count: 0,
    total_sessions: 0,
    attendance_rate: 0
});

const normalizeCourseWise = (rows = []) => {
    return rows.map((row) => {
        const totalMarks = asNumber(row.total_marks);
        const attendedCount = asNumber(row.attended_count);

        return {
            batch_id: row.batch_id,
            batch_name: row.batch_name,
            course: row.course,
            total_marks: totalMarks,
            total_sessions: asNumber(row.total_sessions),
            attended_count: attendedCount,
            absent_count: asNumber(row.absent_count),
            late_count: asNumber(row.late_count),
            attendance_rate: toRate(attendedCount, totalMarks)
        };
    });
};

const normalizeStudentWise = (rows = []) => {
    return rows.map((row) => {
        const totalMarks = asNumber(row.total_marks);
        const attendedCount = asNumber(row.attended_count);

        return {
            student_id: row.student_id,
            student_name: row.student_name,
            total_marks: totalMarks,
            attended_count: attendedCount,
            absent_count: asNumber(row.absent_count),
            late_count: asNumber(row.late_count),
            attendance_rate: toRate(attendedCount, totalMarks)
        };
    });
};

const normalizeTrendRows = (rows = []) => {
    return rows.map((row) => {
        const totalMarks = asNumber(row.total_marks);
        const attendedCount = asNumber(row.attended_count);

        return {
            session_date: row.session_date,
            attended_count: attendedCount,
            absent_count: asNumber(row.absent_count),
            total_marks: totalMarks,
            attendance_rate: toRate(attendedCount, totalMarks)
        };
    });
};

const getAdminVisibleBatches = async (prisma) => {
    const rows = await prisma.$queryRaw`
        SELECT
            b.id,
            COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,
            COALESCE(NULLIF(b.subject, ''), b.course) AS course
        FROM batches b
        ORDER BY batch_name ASC
    `;

    return normalizeBatchRows(rows);
};

const getTeacherVisibleBatches = async (prisma, teacherId) => {
    const rows = await prisma.$queryRaw`
        SELECT DISTINCT
            b.id,
            COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,
            COALESCE(NULLIF(b.subject, ''), b.course) AS course
        FROM batches b
        LEFT JOIN teacher_assignments ta ON ta.batch_id = b.id
        WHERE b.teacher_id = ${teacherId}::uuid
           OR ta.teacher_id = ${teacherId}::uuid
        ORDER BY batch_name ASC
    `;

    return normalizeBatchRows(rows);
};

const getStudentsForBatches = async (prisma, batchIds) => {
    if (!batchIds.length) return [];

    const batchFilter = inUuidSql('e.batch_id', batchIds);
    const rows = await prisma.$queryRaw`
        SELECT DISTINCT
            u.id,
            u.name
        FROM enrollments e
        JOIN users u ON u.id = e.student_id
        WHERE ${batchFilter}
          AND LOWER(e.status::text) = 'active'
        ORDER BY u.name ASC
    `;

    return normalizeStudentRows(rows);
};

const buildTeacherScope = (allBatchIds, selectedBatchId) => {
    if (selectedBatchId) {
        return {
            scopedBatchIds: [selectedBatchId],
            batchScopeSql: Prisma.sql`s.batch_id = ${selectedBatchId}::uuid`
        };
    }

    return {
        scopedBatchIds: allBatchIds,
        batchScopeSql: inUuidSql('s.batch_id', allBatchIds)
    };
};

const getTeacherSummary = async (prisma, { batchScopeSql, studentFilterSql, days }) => {
    const rows = await prisma.$queryRaw`
        SELECT
            COUNT(*)::int AS total_marks,
            SUM(CASE WHEN ar.status::text IN ('present', 'late') THEN 1 ELSE 0 END)::int AS attended_count,
            SUM(CASE WHEN ar.status::text = 'absent' THEN 1 ELSE 0 END)::int AS absent_count,
            SUM(CASE WHEN ar.status::text = 'late' THEN 1 ELSE 0 END)::int AS late_count,
            COUNT(DISTINCT s.id)::int AS total_sessions
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        WHERE ${batchScopeSql}
          AND s.session_date >= CURRENT_DATE - (${days}::int)
          ${studentFilterSql}
    `;

    return buildSummary(rows[0] || {});
};

const getTeacherCourseWise = async (prisma, { batchScopeSql, studentFilterSql, days }) => {
    const rows = await prisma.$queryRaw`
        SELECT
            b.id AS batch_id,
            COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,
            COALESCE(NULLIF(b.subject, ''), b.course) AS course,
            COUNT(*)::int AS total_marks,
            COUNT(DISTINCT s.id)::int AS total_sessions,
            SUM(CASE WHEN ar.status::text IN ('present', 'late') THEN 1 ELSE 0 END)::int AS attended_count,
            SUM(CASE WHEN ar.status::text = 'absent' THEN 1 ELSE 0 END)::int AS absent_count,
            SUM(CASE WHEN ar.status::text = 'late' THEN 1 ELSE 0 END)::int AS late_count
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        JOIN batches b ON b.id = s.batch_id
        WHERE ${batchScopeSql}
          AND s.session_date >= CURRENT_DATE - (${days}::int)
          ${studentFilterSql}
        GROUP BY b.id, b.batch_name, b.name, b.subject, b.course
        ORDER BY batch_name ASC
    `;

    return normalizeCourseWise(rows);
};

const getTeacherStudentWise = async (prisma, { batchScopeSql, studentFilterSql, days }) => {
    const rows = await prisma.$queryRaw`
        SELECT
            u.id AS student_id,
            u.name AS student_name,
            COUNT(*)::int AS total_marks,
            SUM(CASE WHEN ar.status::text IN ('present', 'late') THEN 1 ELSE 0 END)::int AS attended_count,
            SUM(CASE WHEN ar.status::text = 'absent' THEN 1 ELSE 0 END)::int AS absent_count,
            SUM(CASE WHEN ar.status::text = 'late' THEN 1 ELSE 0 END)::int AS late_count
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        JOIN users u ON u.id = ar.student_id
        WHERE ${batchScopeSql}
          AND s.session_date >= CURRENT_DATE - (${days}::int)
          ${studentFilterSql}
        GROUP BY u.id, u.name
        ORDER BY u.name ASC
    `;

    return normalizeStudentWise(rows);
};

const getTeacherTrend = async (prisma, { batchScopeSql, studentFilterSql, days }) => {
    const rows = await prisma.$queryRaw`
        SELECT
            TO_CHAR(s.session_date, 'YYYY-MM-DD') AS session_date,
            SUM(CASE WHEN ar.status::text IN ('present', 'late') THEN 1 ELSE 0 END)::int AS attended_count,
            SUM(CASE WHEN ar.status::text = 'absent' THEN 1 ELSE 0 END)::int AS absent_count,
            COUNT(*)::int AS total_marks
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        WHERE ${batchScopeSql}
          AND s.session_date >= CURRENT_DATE - (${days}::int)
          ${studentFilterSql}
        GROUP BY s.session_date
        ORDER BY s.session_date ASC
    `;

    return normalizeTrendRows(rows);
};

const getStudentVisibleBatches = async (prisma, studentId) => {
    const rows = await prisma.$queryRaw`
        WITH student_batch_ids AS (
            SELECT e.batch_id
            FROM enrollments e
            WHERE e.student_id = ${studentId}::uuid
            UNION
            SELECT s.batch_id
            FROM attendance_records ar
            JOIN attendance_sessions s ON s.id = ar.session_id
            WHERE ar.student_id = ${studentId}::uuid
        )
        SELECT DISTINCT
            b.id,
            COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,
            COALESCE(NULLIF(b.subject, ''), b.course) AS course
        FROM student_batch_ids sb
        JOIN batches b ON b.id = sb.batch_id
        ORDER BY batch_name ASC
    `;

    return normalizeBatchRows(rows);
};

const getStudentSummary = async (prisma, { batchScopeSql, studentId, days }) => {
    const rows = await prisma.$queryRaw`
        SELECT
            COUNT(*)::int AS total_marks,
            SUM(CASE WHEN ar.status::text IN ('present', 'late') THEN 1 ELSE 0 END)::int AS attended_count,
            SUM(CASE WHEN ar.status::text = 'absent' THEN 1 ELSE 0 END)::int AS absent_count,
            SUM(CASE WHEN ar.status::text = 'late' THEN 1 ELSE 0 END)::int AS late_count,
            COUNT(DISTINCT s.id)::int AS total_sessions
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        WHERE ar.student_id = ${studentId}::uuid
          AND ${batchScopeSql}
          AND s.session_date >= CURRENT_DATE - (${days}::int)
    `;

    return buildSummary(rows[0] || {});
};

const getStudentCourseWise = async (prisma, { batchScopeSql, studentId, days }) => {
    const rows = await prisma.$queryRaw`
        SELECT
            b.id AS batch_id,
            COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,
            COALESCE(NULLIF(b.subject, ''), b.course) AS course,
            COUNT(*)::int AS total_marks,
            COUNT(DISTINCT s.id)::int AS total_sessions,
            SUM(CASE WHEN ar.status::text IN ('present', 'late') THEN 1 ELSE 0 END)::int AS attended_count,
            SUM(CASE WHEN ar.status::text = 'absent' THEN 1 ELSE 0 END)::int AS absent_count,
            SUM(CASE WHEN ar.status::text = 'late' THEN 1 ELSE 0 END)::int AS late_count
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        JOIN batches b ON b.id = s.batch_id
        WHERE ar.student_id = ${studentId}::uuid
          AND ${batchScopeSql}
          AND s.session_date >= CURRENT_DATE - (${days}::int)
        GROUP BY b.id, b.batch_name, b.name, b.subject, b.course
        ORDER BY batch_name ASC
    `;

    return normalizeCourseWise(rows);
};

const getStudentTrend = async (prisma, { batchScopeSql, studentId, days }) => {
    const rows = await prisma.$queryRaw`
        SELECT
            TO_CHAR(s.session_date, 'YYYY-MM-DD') AS session_date,
            COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,
            ar.status::text AS status,
            CASE WHEN ar.status::text IN ('present', 'late') THEN 1 ELSE 0 END AS attended_flag
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        JOIN batches b ON b.id = s.batch_id
        WHERE ar.student_id = ${studentId}::uuid
          AND ${batchScopeSql}
          AND s.session_date >= CURRENT_DATE - (${days}::int)
        ORDER BY s.session_date ASC
    `;

    return rows.map((row) => ({
        session_date: row.session_date,
        batch_name: row.batch_name,
        status: row.status,
        attended_flag: asNumber(row.attended_flag)
    }));
};

export const getTeacherAttendanceAnalytics = async (
    prisma,
    {
        requesterId,
        requesterRole,
        batchId,
        studentId,
        lookbackDays = DEFAULT_LOOKBACK_DAYS
    }
) => {
    const role = String(requesterRole || '').toLowerCase();
    const days = clampLookbackDays(lookbackDays);

    const availableBatches =
        role === 'admin'
            ? await getAdminVisibleBatches(prisma)
            : await getTeacherVisibleBatches(prisma, requesterId);

    if (batchId && !availableBatches.some((batch) => batch.id === batchId)) {
        const error = new Error('Requested batch is not accessible by the current user.');
        error.statusCode = 403;
        throw error;
    }

    if (!availableBatches.length) {
        return {
            meta: {
                role,
                lookback_days: days,
                selected_batch_id: batchId || null,
                selected_student_id: studentId || null,
                generated_at: new Date().toISOString()
            },
            available_batches: [],
            available_students: [],
            summary: emptySummary(),
            course_wise: [],
            student_wise: [],
            trend: []
        };
    }

    const { scopedBatchIds, batchScopeSql } = buildTeacherScope(
        availableBatches.map((batch) => batch.id),
        batchId
    );

    const availableStudents = await getStudentsForBatches(prisma, scopedBatchIds);

    if (studentId && !availableStudents.some((student) => student.id === studentId)) {
        const error = new Error('Requested student is not enrolled in the selected teacher scope.');
        error.statusCode = 403;
        throw error;
    }

    const studentFilterSql = studentId ? Prisma.sql`AND ar.student_id = ${studentId}::uuid` : Prisma.empty;

    const [summary, courseWise, studentWise, trend] = await Promise.all([
        getTeacherSummary(prisma, { batchScopeSql, studentFilterSql, days }),
        getTeacherCourseWise(prisma, { batchScopeSql, studentFilterSql, days }),
        getTeacherStudentWise(prisma, { batchScopeSql, studentFilterSql, days }),
        getTeacherTrend(prisma, { batchScopeSql, studentFilterSql, days })
    ]);

    return {
        meta: {
            role,
            lookback_days: days,
            selected_batch_id: batchId || null,
            selected_student_id: studentId || null,
            generated_at: new Date().toISOString()
        },
        available_batches: availableBatches,
        available_students: availableStudents,
        summary,
        course_wise: courseWise,
        student_wise: studentWise,
        trend
    };
};

export const getStudentAttendanceAnalytics = async (
    prisma,
    {
        studentId,
        batchId,
        lookbackDays = DEFAULT_LOOKBACK_DAYS
    }
) => {
    const days = clampLookbackDays(lookbackDays);
    const availableBatches = await getStudentVisibleBatches(prisma, studentId);

    if (batchId && !availableBatches.some((batch) => batch.id === batchId)) {
        const error = new Error('Requested batch is not available for this student.');
        error.statusCode = 403;
        throw error;
    }

    if (!availableBatches.length) {
        return {
            meta: {
                role: 'student',
                lookback_days: days,
                selected_batch_id: batchId || null,
                generated_at: new Date().toISOString()
            },
            available_batches: [],
            summary: emptySummary(),
            course_wise: [],
            trend: []
        };
    }

    const scopedBatchIds = batchId ? [batchId] : availableBatches.map((batch) => batch.id);
    const batchScopeSql = inUuidSql('s.batch_id', scopedBatchIds);

    const [summary, courseWise, trend] = await Promise.all([
        getStudentSummary(prisma, { batchScopeSql, studentId, days }),
        getStudentCourseWise(prisma, { batchScopeSql, studentId, days }),
        getStudentTrend(prisma, { batchScopeSql, studentId, days })
    ]);

    return {
        meta: {
            role: 'student',
            lookback_days: days,
            selected_batch_id: batchId || null,
            generated_at: new Date().toISOString()
        },
        available_batches: availableBatches,
        summary,
        course_wise: courseWise,
        trend
    };
};
