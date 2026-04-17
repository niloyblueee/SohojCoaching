import { Prisma } from '@prisma/client';

const normalizeText = (value) => String(value || '').trim();
const normalizeRoutine = (value) => {
    if (!Array.isArray(value)) return [];

    return value
        .map((entry) => ({
            day: normalizeText(entry?.day),
            subject: normalizeText(entry?.subject),
            time: normalizeText(entry?.time)
        }))
        .filter((entry) => entry.day && entry.subject && entry.time);
};

const normalizeBatchRecord = (batch) => {
    const batchName = batch.batchName || batch.name;
    const subject = batch.subject || batch.course;
    const monthlyFee = batch.monthlyFee == null ? 0 : Number(batch.monthlyFee);
    const discountedFee = batch.discountedFee == null ? null : Number(batch.discountedFee);

    return {
        id: batch.id,
        batch_name: batchName,
        subject,
        schedule: batch.schedule || '',
        monthly_fee: monthlyFee,
        discounted_fee: discountedFee,
        batch_duration: batch.batchDuration || '',
        description: batch.description || '',
        weekly_routine: normalizeRoutine(batch.weeklyRoutine),
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

const getRoleScopedBatchWhere = (auth) => {
    const role = String(auth?.role || '').toLowerCase();
    const userId = String(auth?.sub || '').trim();

    if (role !== 'teacher' || !userId) return undefined;

    return {
        OR: [
            { teacherId: userId },
            { teacherAssignments: { some: { teacherId: userId } } }
        ]
    };
};

export const getBatches = async (prisma, { search = '', sortBy = 'created_at', sortOrder = 'desc', auth } = {}) => {
    const safeSortOrder = parseSortOrder(sortOrder);
    const q = normalizeText(search);
    const scopedWhere = getRoleScopedBatchWhere(auth);
    const searchWhere = q
        ? {
            OR: [
                { batchName: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } }
            ]
        }
        : undefined;

    const whereClauses = [scopedWhere, searchWhere].filter(Boolean);
    const where = whereClauses.length === 0 ? undefined : whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };

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

export const getBatchById = async (prisma, id, { auth } = {}) => {
    const scopedWhere = getRoleScopedBatchWhere(auth);
    const where = scopedWhere ? { AND: [{ id }, scopedWhere] } : { id };

    const batch = await prisma.batch.findFirst({
        where,
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
    const discountedFee =
        payload.discounted_fee === undefined || payload.discounted_fee === null || payload.discounted_fee === ''
            ? null
            : Number(payload.discounted_fee);
    const batchDuration = normalizeText(payload.batch_duration);
    const description = normalizeText(payload.description);
    const weeklyRoutine = normalizeRoutine(payload.weekly_routine);

    if (discountedFee != null && discountedFee > monthlyFee) {
        const error = new Error('discounted_fee cannot be greater than monthly_fee.');
        error.statusCode = 400;
        throw error;
    }

    await assertTeacher(prisma, teacherId);

    const data = {
        name: batchName,
        course: subject,
        batchName,
        subject,
        schedule,
        monthlyFee: new Prisma.Decimal(monthlyFee),
        discountedFee: discountedFee == null ? null : new Prisma.Decimal(discountedFee),
        batchDuration,
        description,
        weeklyRoutine,
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
    const existing = await prisma.batch.findUnique({
        where: { id },
        select: { monthlyFee: true, discountedFee: true }
    });

    if (!existing) {
        const error = new Error('Batch not found.');
        error.statusCode = 404;
        throw error;
    }

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

    if (payload.discounted_fee !== undefined) {
        updates.discountedFee =
            payload.discounted_fee === null || payload.discounted_fee === ''
                ? null
                : new Prisma.Decimal(Number(payload.discounted_fee));
    }

    const nextMonthlyFee =
        updates.monthlyFee !== undefined
            ? Number(updates.monthlyFee)
            : existing.monthlyFee == null
                ? 0
                : Number(existing.monthlyFee);
    const nextDiscountedFee =
        updates.discountedFee !== undefined
            ? (updates.discountedFee == null ? null : Number(updates.discountedFee))
            : existing.discountedFee == null
                ? null
                : Number(existing.discountedFee);

    if (nextDiscountedFee != null && nextDiscountedFee > nextMonthlyFee) {
        const error = new Error('discounted_fee cannot be greater than monthly_fee.');
        error.statusCode = 400;
        throw error;
    }

    if (payload.batch_duration !== undefined) {
        updates.batchDuration = normalizeText(payload.batch_duration);
    }

    if (payload.description !== undefined) {
        updates.description = normalizeText(payload.description);
    }

    if (payload.weekly_routine !== undefined) {
        updates.weeklyRoutine = normalizeRoutine(payload.weekly_routine);
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
    const batch = await prisma.batch.findUnique({ where: { id } });

    if (!batch) {
        const error = new Error('Batch not found.');
        error.statusCode = 404;
        throw error;
    }

    await prisma.$transaction([
        prisma.teacherAssignment.deleteMany({ where: { batchId: id } }),
        prisma.enrollment.deleteMany({ where: { batchId: id } }),
        prisma.studyMaterial.deleteMany({ where: { batchId: id } }),
        prisma.studentScript.deleteMany({ where: { batchId: id } }),
        prisma.batch.delete({ where: { id } })
    ]);
};
