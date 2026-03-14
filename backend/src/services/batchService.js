import { Prisma } from '@prisma/client';

const normalizeText = (value) => String(value || '').trim();

const normalizeBatchRecord = (batch) => {
    const batchName = batch.batchName || batch.name;
    const subject = batch.subject || batch.course;
    const monthlyFee = batch.monthlyFee == null ? 0 : Number(batch.monthlyFee);

    return {
        id: batch.id,
        batch_name: batchName,
        subject,
        schedule: batch.schedule || '',
        monthly_fee: monthlyFee,
        teacher_id: batch.teacherId || null,
        created_at: batch.createdAt,
        student_count: batch._count?.enrollments || 0,
        teacher_name: batch.teacher?.name || null,
        name: batchName,
        course: subject
    };
};

const assertTeacher = async (prisma, teacherId) => {
    if (!teacherId) return;

    const teacher = await prisma.user.findUnique({
        where: { id: teacherId },
        select: { id: true, role: true }
    });

    if (!teacher) {
        const error = new Error('Assigned teacher not found.');
        error.statusCode = 404;
        throw error;
    }

    if (String(teacher.role).toLowerCase() !== 'teacher') {
        const error = new Error('teacher_id must reference a teacher account.');
        error.statusCode = 400;
        throw error;
    }
};

const parseSortOrder = (value) => (String(value || '').toLowerCase() === 'asc' ? 'asc' : 'desc');

export const getBatches = async (prisma, { search = '', sortBy = 'created_at', sortOrder = 'desc' } = {}) => {
    const safeSortOrder = parseSortOrder(sortOrder);
    const q = normalizeText(search);

    const where = q
        ? {
            OR: [
                { batchName: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } }
            ]
        }
        : undefined;

    let orderBy;
    if (sortBy === 'student_count') {
        orderBy = { enrollments: { _count: safeSortOrder } };
    } else if (sortBy === 'batch_name') {
        orderBy = { batchName: safeSortOrder };
    } else if (sortBy === 'monthly_fee') {
        orderBy = { monthlyFee: safeSortOrder };
    } else {
        orderBy = { createdAt: safeSortOrder };
    }

    const batches = await prisma.batch.findMany({
        where,
        include: {
            teacher: {
                select: { id: true, name: true }
            },
            _count: {
                select: { enrollments: true }
            }
        },
        orderBy
    });

    return batches.map(normalizeBatchRecord);
};

export const getBatchById = async (prisma, id) => {
    const batch = await prisma.batch.findUnique({
        where: { id },
        include: {
            teacher: {
                select: { id: true, name: true }
            },
            _count: {
                select: { enrollments: true }
            }
        }
    });

    if (!batch) return null;
    return normalizeBatchRecord(batch);
};

export const createBatch = async (prisma, payload) => {
    const batchName = normalizeText(payload.batch_name);
    const subject = normalizeText(payload.subject);
    const schedule = normalizeText(payload.schedule);
    const teacherId = payload.teacher_id || null;
    const monthlyFee = Number(payload.monthly_fee);

    await assertTeacher(prisma, teacherId);

    const data = {
        name: batchName,
        course: subject,
        batchName,
        subject,
        schedule,
        monthlyFee: new Prisma.Decimal(monthlyFee),
        teacherId
    };

    const created = await prisma.batch.create({
        data,
        include: {
            teacher: {
                select: { id: true, name: true }
            },
            _count: {
                select: { enrollments: true }
            }
        }
    });

    return normalizeBatchRecord(created);
};

export const updateBatch = async (prisma, id, payload) => {
    const updates = {};

    if (payload.batch_name !== undefined) {
        const batchName = normalizeText(payload.batch_name);
        updates.batchName = batchName;
        updates.name = batchName;
    }

    if (payload.subject !== undefined) {
        const subject = normalizeText(payload.subject);
        updates.subject = subject;
        updates.course = subject;
    }

    if (payload.schedule !== undefined) {
        updates.schedule = normalizeText(payload.schedule);
    }

    if (payload.monthly_fee !== undefined) {
        updates.monthlyFee = new Prisma.Decimal(Number(payload.monthly_fee));
    }

    if (payload.teacher_id !== undefined) {
        const teacherId = payload.teacher_id || null;
        await assertTeacher(prisma, teacherId);
        updates.teacherId = teacherId;
    }

    const updated = await prisma.batch.update({
        where: { id },
        data: updates,
        include: {
            teacher: {
                select: { id: true, name: true }
            },
            _count: {
                select: { enrollments: true }
            }
        }
    });

    return normalizeBatchRecord(updated);
};

export const deleteBatch = async (prisma, id) => {
    const batch = await prisma.batch.findUnique({
        where: { id },
        include: {
            _count: {
                select: { enrollments: true }
            }
        }
    });

    if (!batch) {
        const error = new Error('Batch not found.');
        error.statusCode = 404;
        throw error;
    }

    if ((batch._count?.enrollments || 0) > 0) {
        const error = new Error('Cannot delete a batch that already has enrolled students.');
        error.statusCode = 409;
        throw error;
    }

    await prisma.batch.delete({ where: { id } });
};
