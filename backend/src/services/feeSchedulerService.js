import { ensureMonthlyDues } from './feeService.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

let feeSchedulerInterval = null;
let generationRunning = false;

const executeGeneration = async (prisma, { dayOneOnly, reason }) => {
    if (generationRunning) return;
    generationRunning = true;

    try {
        const result = await ensureMonthlyDues(prisma, { dayOneOnly });
        if (!result.skipped || result.created_due_rows > 0 || result.synced_paid_rows > 0) {
            console.log(
                `[FeeScheduler:${reason}] created=${result.created_due_rows} synced=${result.synced_paid_rows} at=${result.executed_at}`
            );
        }
    } catch (error) {
        console.error(`[FeeScheduler:${reason}] failed:`, error.message);
    } finally {
        generationRunning = false;
    }
};

export const startFeeScheduler = (prisma) => {
    if (feeSchedulerInterval) return;

    executeGeneration(prisma, { dayOneOnly: false, reason: 'startup' });

    feeSchedulerInterval = setInterval(() => {
        executeGeneration(prisma, { dayOneOnly: true, reason: 'hourly-check' });
    }, ONE_HOUR_MS);

    if (typeof feeSchedulerInterval.unref === 'function') {
        feeSchedulerInterval.unref();
    }
};
