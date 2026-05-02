import { isUuid } from '../utils/validators.js';
import {
    ensureMonthlyDues,
    getAdminFeeDashboard,
    getStudentFeeDashboard,
    recordAdminPayment
} from '../services/feeService.js';

export const getAdminFeesController = (prisma) => async (_req, res) => {
    try {
        const payload = await getAdminFeeDashboard(prisma);
        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to load fee dashboard.' });
    }
};

export const generateMonthlyFeesController = (prisma) => async (req, res) => {
    const asOfValue = req.body?.as_of;
    const asOfDate = asOfValue ? new Date(asOfValue) : new Date();

    if (Number.isNaN(asOfDate.getTime())) {
        return res.status(400).json({ error: 'Invalid as_of date provided.' });
    }

    try {
        const generation = await ensureMonthlyDues(prisma, { asOfDate });
        return res.json({
            message: 'Monthly dues generated successfully.',
            ...generation
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to generate monthly dues.' });
    }
};

export const recordPaymentController = (prisma) => async (req, res) => {
    const { enrollment_id, month_number, due_id, payment_method, transaction_info, amount_paid } = req.body || {};

    if (!isUuid(enrollment_id)) {
        return res.status(400).json({ error: 'enrollment_id must be a valid UUID.' });
    }

    if (due_id !== undefined && due_id !== null && due_id !== '' && !isUuid(due_id)) {
        return res.status(400).json({ error: 'due_id must be a valid UUID when provided.' });
    }

    if (month_number !== undefined && month_number !== null && month_number !== '') {
        const parsed = Number(month_number);
        if (!Number.isInteger(parsed) || parsed < 1) {
            return res.status(400).json({ error: 'month_number must be a positive integer when provided.' });
        }
    }

    if (amount_paid !== undefined && amount_paid !== null && amount_paid !== '') {
        const parsed = Number(amount_paid);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return res.status(400).json({ error: 'amount_paid must be a positive number when provided.' });
        }
    }

    try {
        const payload = await recordAdminPayment(prisma, {
            enrollmentId: enrollment_id,
            monthNumber: month_number,
            dueId: due_id,
            paymentMethod: payment_method,
            transactionInfo: transaction_info,
            amountPaid: amount_paid,
            recordedBy: req.auth?.sub || null
        });

        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to record payment.' });
    }
};

export const getStudentFeesController = (prisma) => async (req, res) => {
    const studentId = req.auth?.sub;

    if (!isUuid(studentId)) {
        return res.status(400).json({ error: 'Unable to resolve a valid student identity from token.' });
    }

    try {
        const payload = await getStudentFeeDashboard(prisma, studentId);
        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to load student fees.' });
    }
};
