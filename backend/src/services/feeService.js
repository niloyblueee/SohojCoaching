import { isUuid } from '../utils/validators.js';

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric'
});

const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short'
});

const toMonthStart = (value = new Date()) =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const addMonths = (monthStart, monthsToAdd) =>
    new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + monthsToAdd, 1));

const monthDiff = (startMonth, endMonth) =>
    (endMonth.getUTCFullYear() - startMonth.getUTCFullYear()) * 12 +
    (endMonth.getUTCMonth() - startMonth.getUTCMonth());

const toMonthKey = (value) => toMonthStart(new Date(value)).toISOString().slice(0, 10);

const parseDurationMonths = (rawDuration) => {
    const match = String(rawDuration || '').match(/\d+/);
    const parsed = match ? Number.parseInt(match[0], 10) : 1;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const toNumberValue = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toAmount = (value) => Math.round(toNumberValue(value));

const buildMonthlyIncomeSeries = (year, rows = []) => {
    const buckets = [];
    const bucketByMonth = new Map();

    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const monthNumber = monthIndex + 1;
        const labelDate = new Date(Date.UTC(year, monthIndex, 1));
        const bucket = {
            month: monthNumber,
            label: MONTH_SHORT_FORMATTER.format(labelDate),
            total_paid: 0
        };
        buckets.push(bucket);
        bucketByMonth.set(monthNumber, bucket);
    }

    for (const row of rows) {
        const monthNumber = toNumberValue(row.month);
        if (!Number.isFinite(monthNumber)) continue;
        const bucket = bucketByMonth.get(monthNumber);
        if (!bucket) continue;
        bucket.total_paid = toAmount(row.total_paid);
    }

    return buckets;
};

const resolveEffectiveFee = (batch) => {
    if (!batch) return 0;
    return batch.discountedFee != null ? toAmount(batch.discountedFee) : toAmount(batch.monthlyFee);
};

const mapDueWithPayment = (due, paymentByMonth) => {
    const payment = paymentByMonth.get(due.monthNumber) || null;
    const dueMarkedPaid = String(due.status || '').toLowerCase() === 'paid';
    const isPaid = dueMarkedPaid || Boolean(payment);
    const fallbackPaidAmount = isPaid ? Number(due.amountDue || 0) : 0;
    const paidAmount = payment ? Number(payment.amountPaid || 0) : fallbackPaidAmount;
    const paymentDate = payment?.paymentDate || due.paidAt || null;
    const dueMonthDate = new Date(due.dueMonth);

    return {
        due_id: due.id,
        month_number: due.monthNumber,
        due_month: dueMonthDate.toISOString().slice(0, 10),
        due_month_label: MONTH_LABEL_FORMATTER.format(dueMonthDate),
        due_month_key: toMonthKey(dueMonthDate),
        amount_due: Number(due.amountDue || 0),
        status: isPaid ? 'paid' : 'unpaid',
        is_paid: isPaid,
        amount_paid: paidAmount,
        payment_date: paymentDate ? paymentDate.toISOString() : null,
        payment_method: payment?.paymentMethod || null,
        transaction_info: payment?.transactionInfo || null
    };
};

const buildEnrollmentFeeSummary = (enrollment) => {
    const monthlyFee = resolveEffectiveFee(enrollment.batch);
    const paymentByMonth = new Map();
    let totalPaid = 0;

    for (const payment of enrollment.feePayments) {
        paymentByMonth.set(payment.monthNumber, payment);
        totalPaid += Number(payment.amountPaid || 0);
    }

    const dues = enrollment.feeDues
        .map((due) => mapDueWithPayment(due, paymentByMonth))
        .sort((a, b) => a.month_number - b.month_number);

    const totalPayable = dues.reduce((sum, due) => sum + Number(due.amount_due || 0), 0);
    const totalDue = Math.max(totalPayable - totalPaid, 0);
    const paidMonths = dues.filter((due) => due.is_paid).length;
    const totalGeneratedMonths = dues.length;
    const completionRate =
        totalPayable > 0 ? Number(Math.min((totalPaid / totalPayable) * 100, 100).toFixed(2)) : 0;
    const nextDue = dues.find((due) => !due.is_paid) || null;

    return {
        enrollment_id: enrollment.id,
        student_id: enrollment.studentId,
        student_name: enrollment.student.name,
        batch_id: enrollment.batchId,
        batch_name: enrollment.batch.batchName || enrollment.batch.name,
        duration_months: parseDurationMonths(enrollment.batch.batchDuration),
        monthly_fee: monthlyFee,
        total_payable: totalPayable,
        total_paid: totalPaid,
        total_due: totalDue,
        paid_months: paidMonths,
        total_generated_months: totalGeneratedMonths,
        completion_rate: completionRate,
        next_due_month: nextDue?.due_month_label || null,
        next_due_amount: nextDue?.amount_due || 0,
        dues
    };
};

export const ensureMonthlyDues = async (prisma, { asOfDate = new Date(), dayOneOnly = false } = {}) => {
    const executionDate = new Date(asOfDate);
    if (Number.isNaN(executionDate.getTime())) {
        const error = new Error('Invalid asOfDate provided for fee due generation.');
        error.statusCode = 400;
        throw error;
    }

    if (dayOneOnly && executionDate.getUTCDate() !== 1 && executionDate.getDate() !== 1) {
        return {
            skipped: true,
            created_due_rows: 0,
            synced_paid_rows: 0,
            executed_at: executionDate.toISOString()
        };
    }

    const targetMonth = toMonthStart(executionDate);

    const enrollments = await prisma.enrollment.findMany({
        where: { status: 'active' },
        select: {
            id: true,
            enrolledAt: true,
            batch: {
                select: {
                    batchDuration: true,
                    monthlyFee: true,
                    discountedFee: true
                }
            }
        }
    });

    const dueRowsToCreate = [];

    for (const enrollment of enrollments) {
        const startMonth = toMonthStart(new Date(enrollment.enrolledAt));
        const spanMonths = monthDiff(startMonth, targetMonth) + 1;

        if (spanMonths <= 0) continue;

        const maxDurationMonths = parseDurationMonths(enrollment.batch.batchDuration);
        const monthCount = Math.min(maxDurationMonths, spanMonths);
        const amountDue = resolveEffectiveFee(enrollment.batch);

        for (let monthIndex = 0; monthIndex < monthCount; monthIndex += 1) {
            dueRowsToCreate.push({
                enrollmentId: enrollment.id,
                monthNumber: monthIndex + 1,
                dueMonth: addMonths(startMonth, monthIndex),
                amountDue
            });
        }
    }

    const createResult =
        dueRowsToCreate.length > 0
            ? await prisma.feeDue.createMany({
                data: dueRowsToCreate,
                skipDuplicates: true
            })
            : { count: 0 };

    const syncedPaidRows = await prisma.$executeRaw`
        UPDATE fee_dues AS fd
        SET status = 'paid',
            paid_at = COALESCE(fd.paid_at, fp.payment_date)
        FROM fee_payments fp
        WHERE fd.enrollment_id = fp.enrollment_id
          AND fd.month_number = fp.month_number
          AND fd.status <> 'paid'
    `;

    return {
        skipped: false,
        created_due_rows: Number(createResult.count || 0),
        synced_paid_rows: Number(syncedPaidRows || 0),
        executed_at: executionDate.toISOString()
    };
};

export const getAdminFeeDashboard = async (prisma) => {
    const generation = await ensureMonthlyDues(prisma);
    const currentMonthKey = toMonthKey(new Date());

    const enrollments = await prisma.enrollment.findMany({
        where: { status: 'active' },
        include: {
            student: {
                select: { id: true, name: true }
            },
            batch: {
                select: {
                    id: true,
                    name: true,
                    batchName: true,
                    batchDuration: true,
                    monthlyFee: true,
                    discountedFee: true
                }
            },
            feeDues: {
                orderBy: { monthNumber: 'asc' }
            },
            feePayments: {
                orderBy: { monthNumber: 'asc' }
            }
        }
    });

    const rows = enrollments
        .map((enrollment) => buildEnrollmentFeeSummary(enrollment))
        .sort((a, b) => a.student_name.localeCompare(b.student_name));

    const studentIds = new Set(rows.map((row) => row.student_id));
    let totalPayable = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let paidDueCount = 0;
    let unpaidDueCount = 0;
    let currentMonthPayable = 0;

    for (const row of rows) {
        totalPayable += row.total_payable;
        totalPaid += row.total_paid;
        totalDue += row.total_due;

        for (const due of row.dues) {
            if (due.is_paid) paidDueCount += 1;
            else unpaidDueCount += 1;

            if (due.due_month_key === currentMonthKey) {
                currentMonthPayable += Number(due.amount_due || 0);
            }
        }
    }

    let currentMonthPaid = 0;
    for (const enrollment of enrollments) {
        for (const payment of enrollment.feePayments) {
            if (toMonthKey(payment.paymentDate) === currentMonthKey) {
                currentMonthPaid += Number(payment.amountPaid || 0);
            }
        }
    }

    const collectionRate = totalPayable > 0 ? Number(((totalPaid / totalPayable) * 100).toFixed(2)) : 0;
    const currentMonthCollectionRate =
        currentMonthPayable > 0 ? Number(((currentMonthPaid / currentMonthPayable) * 100).toFixed(2)) : 0;

    const currentMonthStart = toMonthStart(new Date());
    const nextMonthStart = addMonths(currentMonthStart, 1);
    const currentYear = currentMonthStart.getUTCFullYear();
    const yearStart = new Date(Date.UTC(currentYear, 0, 1));
    const yearEnd = new Date(Date.UTC(currentYear + 1, 0, 1));

    const [incomeRows, expectedRows, realizedRows] = await Promise.all([
        prisma.$queryRaw`
            SELECT
                EXTRACT(MONTH FROM fp.payment_date) AS month,
                COALESCE(SUM(fp.amount_paid), 0) AS total_paid
            FROM fee_payments fp
            WHERE fp.payment_date >= ${yearStart}
              AND fp.payment_date < ${yearEnd}
            GROUP BY month
            ORDER BY month
        `,
        prisma.$queryRaw`
            SELECT
                COALESCE(SUM(COALESCE(b.discounted_fee, b.monthly_fee)), 0) AS expected_total,
                COUNT(*) AS enrollment_count
            FROM enrollments e
            JOIN batches b ON b.id = e.batch_id
            WHERE LOWER(e.status::text) = 'active'
        `,
        prisma.$queryRaw`
            SELECT COALESCE(SUM(fp.amount_paid), 0) AS realized_total
            FROM fee_payments fp
            WHERE fp.payment_date >= ${currentMonthStart}
              AND fp.payment_date < ${nextMonthStart}
        `
    ]);

    const expectedTotal = toAmount(expectedRows?.[0]?.expected_total);
    const realizedTotal = toAmount(realizedRows?.[0]?.realized_total);
    const pendingTotal = Math.max(expectedTotal - realizedTotal, 0);
    const monthlyIncome = buildMonthlyIncomeSeries(currentYear, incomeRows);

    return {
        generated: generation,
        summary: {
            active_enrollments: rows.length,
            active_students: studentIds.size,
            total_payable: totalPayable,
            total_paid: totalPaid,
            total_due: totalDue,
            collection_rate: collectionRate,
            paid_due_count: paidDueCount,
            unpaid_due_count: unpaidDueCount,
            current_month_payable: currentMonthPayable,
            current_month_paid: currentMonthPaid,
            current_month_collection_rate: currentMonthCollectionRate
        },
        enrollments: rows,
        analytics: {
            year: currentYear,
            monthly_income: monthlyIncome,
            revenue_summary: {
                expected_total: expectedTotal,
                realized_total: realizedTotal,
                pending_total: pendingTotal,
                active_enrollments: Number(expectedRows?.[0]?.enrollment_count || 0)
            },
            current_month: {
                expected: expectedTotal,
                collected: realizedTotal,
                pending: pendingTotal
            }
        }
    };
};

export const getStudentFeeDashboard = async (prisma, studentId) => {
    const generation = await ensureMonthlyDues(prisma);

    const enrollments = await prisma.enrollment.findMany({
        where: {
            studentId,
            status: 'active'
        },
        include: {
            student: {
                select: { id: true, name: true }
            },
            batch: {
                select: {
                    id: true,
                    name: true,
                    batchName: true,
                    batchDuration: true,
                    monthlyFee: true,
                    discountedFee: true
                }
            },
            feeDues: {
                orderBy: { monthNumber: 'asc' }
            },
            feePayments: {
                orderBy: { monthNumber: 'asc' }
            }
        }
    });

    const rows = enrollments.map((enrollment) => buildEnrollmentFeeSummary(enrollment));

    const summary = rows.reduce(
        (acc, row) => {
            acc.total_payable += row.total_payable;
            acc.total_paid += row.total_paid;
            acc.total_due += row.total_due;
            acc.paid_months += row.paid_months;
            acc.total_generated_months += row.total_generated_months;
            return acc;
        },
        {
            total_payable: 0,
            total_paid: 0,
            total_due: 0,
            paid_months: 0,
            total_generated_months: 0
        }
    );

    const collectionRate =
        summary.total_payable > 0 ? Number(((summary.total_paid / summary.total_payable) * 100).toFixed(2)) : 0;

    return {
        generated: generation,
        student_id: studentId,
        student_name: rows[0]?.student_name || null,
        summary: {
            active_enrollments: rows.length,
            total_payable: summary.total_payable,
            total_paid: summary.total_paid,
            total_due: summary.total_due,
            paid_months: summary.paid_months,
            total_generated_months: summary.total_generated_months,
            collection_rate: collectionRate
        },
        enrollments: rows
    };
};

export const recordAdminPayment = async (
    prisma,
    { enrollmentId, monthNumber, dueId, paymentMethod, transactionInfo, amountPaid, recordedBy }
) => {
    await ensureMonthlyDues(prisma);

    const enrollment = await prisma.enrollment.findFirst({
        where: {
            id: enrollmentId,
            status: 'active'
        },
        include: {
            batch: {
                select: {
                    monthlyFee: true,
                    discountedFee: true
                }
            },
            feeDues: {
                orderBy: { monthNumber: 'asc' }
            }
        }
    });

    if (!enrollment) {
        const error = new Error('Enrollment not found or not active.');
        error.statusCode = 404;
        throw error;
    }

    const parsedMonthNumber =
        monthNumber === undefined || monthNumber === null || monthNumber === ''
            ? null
            : Number.parseInt(monthNumber, 10);

    if (parsedMonthNumber !== null && (!Number.isInteger(parsedMonthNumber) || parsedMonthNumber < 1)) {
        const error = new Error('month_number must be a positive integer when provided.');
        error.statusCode = 400;
        throw error;
    }

    let selectedDue = null;
    if (dueId) {
        selectedDue = enrollment.feeDues.find((due) => due.id === dueId) || null;
    } else if (parsedMonthNumber !== null) {
        selectedDue = enrollment.feeDues.find((due) => due.monthNumber === parsedMonthNumber) || null;
    } else {
        selectedDue = enrollment.feeDues.find((due) => String(due.status || '').toLowerCase() !== 'paid') || null;
    }

    if (!selectedDue) {
        const error = new Error('No due month found for this payment request.');
        error.statusCode = 400;
        throw error;
    }

    if (String(selectedDue.status || '').toLowerCase() === 'paid') {
        const error = new Error('This month is already paid.');
        error.statusCode = 400;
        throw error;
    }

    const existingPayment = await prisma.feePayment.findUnique({
        where: {
            enrollmentId_monthNumber: {
                enrollmentId,
                monthNumber: selectedDue.monthNumber
            }
        }
    });

    if (existingPayment) {
        const error = new Error('This month is already paid.');
        error.statusCode = 400;
        throw error;
    }

    const fallbackAmount = Number(selectedDue.amountDue || resolveEffectiveFee(enrollment.batch));
    const requestedAmount =
        amountPaid === undefined || amountPaid === null || amountPaid === '' ? fallbackAmount : Number(amountPaid);

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        const error = new Error('amount_paid must be a positive number.');
        error.statusCode = 400;
        throw error;
    }

    if (Number(requestedAmount) !== Number(fallbackAmount)) {
        const error = new Error('Partial or custom amounts are not allowed. Pay the full monthly due amount.');
        error.statusCode = 400;
        throw error;
    }

    const finalPaymentMethod = String(paymentMethod || 'cash').trim() || 'cash';
    const finalTransactionInfo = String(transactionInfo || '').trim();
    const safeRecordedBy = isUuid(recordedBy) ? recordedBy : null;

    const payment = await prisma.$transaction(async (tx) => {
        const created = await tx.feePayment.create({
            data: {
                enrollmentId,
                monthNumber: selectedDue.monthNumber,
                paymentMethod: finalPaymentMethod,
                transactionInfo: finalTransactionInfo,
                recordedBy: safeRecordedBy,
                amountPaid: Number(fallbackAmount)
            }
        });

        await tx.feeDue.update({
            where: { id: selectedDue.id },
            data: {
                status: 'paid',
                paidAt: created.paymentDate
            }
        });

        return created;
    });

    return {
        message: 'Payment recorded successfully.',
        payment_id: payment.id,
        enrollment_id: enrollmentId,
        due_id: selectedDue.id,
        month_number: selectedDue.monthNumber,
        amount_paid: Number(payment.amountPaid || 0),
        payment_date: payment.paymentDate.toISOString()
    };
};
