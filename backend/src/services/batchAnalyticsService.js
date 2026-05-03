export const getBatchStudentCounts = async (prisma) => {
    const rows = await prisma.$queryRaw`
        SELECT
            b.id AS batch_id,
            COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,
            COUNT(e.student_id)::int AS student_count
        FROM batches b
        LEFT JOIN enrollments e
            ON e.batch_id = b.id
           AND LOWER(e.status::text) = 'active'
        GROUP BY b.id, batch_name
        ORDER BY batch_name ASC
    `;

    return rows.map((row) => ({
        batch_id: row.batch_id,
        batch_name: row.batch_name,
        student_count: Number(row.student_count || 0)
    }));
};
