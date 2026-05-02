import { PrismaClient } from '@prisma/client';
import { ensureMonthlyDues } from '../services/feeService.js';

const prisma = new PrismaClient();

const toMonthStart = (value = new Date()) =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const toMonthKey = (value) => toMonthStart(new Date(value)).toISOString().slice(0, 10);

const addMonths = (monthStart, monthsToAdd) =>
    new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + monthsToAdd, 1));

const FR7_DEMO_EMAIL_PREFIX = 'fr7.demo.student';
const FR7_DEMO_EMAIL_DOMAIN = 'sohojcoaching.test';
const FR7_DEMO_STUDENT_COUNT = 4;

async function ensurePreviousMonthCoverage(previousMonth, currentMonth) {
    const previousDueCount = await prisma.feeDue.count({
        where: {
            dueMonth: {
                gte: previousMonth,
                lt: currentMonth
            }
        }
    });

    if (previousDueCount > 0) {
        return { adjustedEnrollments: 0, previousDueCount };
    }

    const enrollments = await prisma.enrollment.findMany({
        where: { status: 'active' },
        select: { id: true, enrolledAt: true },
        orderBy: { enrolledAt: 'asc' },
        take: 8
    });

    let adjustedEnrollments = 0;
    for (const enrollment of enrollments) {
        const enrolledMonthKey = toMonthKey(enrollment.enrolledAt);
        const previousMonthKey = toMonthKey(previousMonth);

        if (enrolledMonthKey <= previousMonthKey) continue;

        await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { enrolledAt: new Date(previousMonth) }
        });
        adjustedEnrollments += 1;
    }

    if (adjustedEnrollments > 0) {
        await ensureMonthlyDues(prisma, { asOfDate: new Date() });
    }

    const refreshedPreviousDueCount = await prisma.feeDue.count({
        where: {
            dueMonth: {
                gte: previousMonth,
                lt: currentMonth
            }
        }
    });

    return { adjustedEnrollments, previousDueCount: refreshedPreviousDueCount };
}

async function ensureDemoSeedEnrollments(previousMonth) {
    const seedBatch = await prisma.batch.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true }
    });

    if (!seedBatch) {
        throw new Error('No batch found for FR-7 demo enrollment seed.');
    }

    let ensured = 0;

    for (let i = 1; i <= FR7_DEMO_STUDENT_COUNT; i += 1) {
        const email = `${FR7_DEMO_EMAIL_PREFIX}${i}@${FR7_DEMO_EMAIL_DOMAIN}`;
        const student = await prisma.user.upsert({
            where: { email },
            update: {
                name: `FR7 Demo Student ${i}`,
                role: 'student',
                status: 'verified'
            },
            create: {
                name: `FR7 Demo Student ${i}`,
                email,
                role: 'student',
                status: 'verified'
            },
            select: { id: true }
        });

        await prisma.enrollment.upsert({
            where: {
                studentId_batchId: {
                    studentId: student.id,
                    batchId: seedBatch.id
                }
            },
            update: {
                status: 'active',
                enrolledAt: new Date(previousMonth)
            },
            create: {
                studentId: student.id,
                batchId: seedBatch.id,
                status: 'active',
                enrolledAt: new Date(previousMonth)
            }
        });

        ensured += 1;
    }

    return ensured;
}

async function upsertPaymentForDue({ enrollmentId, due, recordedBy, paymentMethod, transactionInfo }) {
    const existing = await prisma.feePayment.findUnique({
        where: {
            enrollmentId_monthNumber: {
                enrollmentId,
                monthNumber: due.monthNumber
            }
        }
    });

    if (existing) return false;

    const created = await prisma.feePayment.create({
        data: {
            enrollmentId,
            monthNumber: due.monthNumber,
            paymentMethod,
            transactionInfo,
            recordedBy,
            amountPaid: Number(due.amountDue || 0)
        }
    });

    await prisma.feeDue.update({
        where: { id: due.id },
        data: {
            status: 'paid',
            paidAt: created.paymentDate
        }
    });

    return true;
}

async function main() {
    const currentMonth = toMonthStart(new Date());
    const previousMonth = addMonths(currentMonth, -1);

    await ensureMonthlyDues(prisma, { asOfDate: new Date() });
    const previousCoverage = await ensurePreviousMonthCoverage(previousMonth, currentMonth);

    const admin = await prisma.user.findFirst({
        where: { role: { equals: 'admin', mode: 'insensitive' } },
        select: { id: true }
    });

    const enrollments = await prisma.enrollment.findMany({
        where: { status: 'active' },
        include: {
            feeDues: {
                orderBy: { monthNumber: 'asc' }
            }
        },
        take: 16
    });

    if (!enrollments.length) {
        throw new Error('No active enrollments found. Seed enrollments first before fee metric seed.');
    }

    const previousMonthKey = toMonthKey(previousMonth);
    const currentMonthKey = toMonthKey(currentMonth);

    let previousMonthPayments = 0;
    let currentMonthPayments = 0;
    let demoEnrollmentsEnsured = 0;

    for (let index = 0; index < enrollments.length; index += 1) {
        const enrollment = enrollments[index];
        const previousDue = enrollment.feeDues.find((due) => toMonthKey(due.dueMonth) === previousMonthKey);
        const currentDue = enrollment.feeDues.find((due) => toMonthKey(due.dueMonth) === currentMonthKey);

        if (previousDue && index % 3 !== 0) {
            const inserted = await upsertPaymentForDue({
                enrollmentId: enrollment.id,
                due: previousDue,
                recordedBy: admin?.id || null,
                paymentMethod: index % 2 === 0 ? 'bKash' : 'cash',
                transactionInfo: `FR7-DEMO-PREV-${index + 1}`
            });
            if (inserted) previousMonthPayments += 1;
        }

        if (currentDue && index % 5 === 0) {
            const inserted = await upsertPaymentForDue({
                enrollmentId: enrollment.id,
                due: currentDue,
                recordedBy: admin?.id || null,
                paymentMethod: 'cash',
                transactionInfo: `FR7-DEMO-CUR-${index + 1}`
            });
            if (inserted) currentMonthPayments += 1;
        }
    }

    if (previousMonthPayments === 0 || currentMonthPayments === 0) {
        demoEnrollmentsEnsured = await ensureDemoSeedEnrollments(previousMonth);
        await ensureMonthlyDues(prisma, { asOfDate: new Date() });

        const demoEnrollments = await prisma.enrollment.findMany({
            where: {
                status: 'active',
                student: {
                    email: {
                        startsWith: FR7_DEMO_EMAIL_PREFIX
                    }
                }
            },
            include: {
                feeDues: {
                    orderBy: { monthNumber: 'asc' }
                }
            },
            orderBy: { enrolledAt: 'asc' }
        });

        for (let index = 0; index < demoEnrollments.length; index += 1) {
            const enrollment = demoEnrollments[index];
            const previousDue = enrollment.feeDues.find((due) => toMonthKey(due.dueMonth) === previousMonthKey);
            const currentDue = enrollment.feeDues.find((due) => toMonthKey(due.dueMonth) === currentMonthKey);

            if (previousMonthPayments === 0 && previousDue) {
                const inserted = await upsertPaymentForDue({
                    enrollmentId: enrollment.id,
                    due: previousDue,
                    recordedBy: admin?.id || null,
                    paymentMethod: index % 2 === 0 ? 'bKash' : 'cash',
                    transactionInfo: `FR7-DEMO-PREV-FALLBACK-${index + 1}`
                });
                if (inserted) previousMonthPayments += 1;
            }

            if (currentMonthPayments === 0 && currentDue) {
                const inserted = await upsertPaymentForDue({
                    enrollmentId: enrollment.id,
                    due: currentDue,
                    recordedBy: admin?.id || null,
                    paymentMethod: 'cash',
                    transactionInfo: `FR7-DEMO-CUR-FALLBACK-${index + 1}`
                });
                if (inserted) currentMonthPayments += 1;
            }

            if (previousMonthPayments > 0 && currentMonthPayments > 0) break;
        }
    }

    const syncStats = await ensureMonthlyDues(prisma, { asOfDate: new Date() });

    console.log('FR-7 fee metrics seed complete.');
    console.log(`Active enrollments scanned: ${enrollments.length}`);
    console.log(`FR-7 demo enrollments ensured: ${demoEnrollmentsEnsured}`);
    console.log(`Enrollments backdated for previous-month coverage: ${previousCoverage.adjustedEnrollments}`);
    console.log(`Previous-month dues available: ${previousCoverage.previousDueCount}`);
    console.log(`Previous-month payments added: ${previousMonthPayments}`);
    console.log(`Current-month payments added: ${currentMonthPayments}`);
    console.log(`Due sync updates: ${syncStats.synced_paid_rows}`);
}

main()
    .catch((error) => {
        console.error('FR-7 fee metrics seed failed:', error.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
