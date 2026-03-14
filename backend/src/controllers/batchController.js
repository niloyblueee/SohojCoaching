import {
    createBatch,
    deleteBatch,
    getBatchById,
    getBatches,
    updateBatch
} from '../services/batchService.js';
import { isUuid } from '../utils/validators.js';

const isPositiveOrZeroNumber = (value) => {
    if (value === undefined || value === null || value === '') return false;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0;
};

export const listBatchesController = (prisma) => async (req, res) => {
    try {
        const data = await getBatches(prisma, {
            search: req.query.search,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

export const getBatchByIdController = (prisma) => async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) {
        return res.status(400).json({ error: 'Invalid batch id.' });
    }

    try {
        const batch = await getBatchById(prisma, id);
        if (!batch) return res.status(404).json({ error: 'Batch not found.' });
        res.json(batch);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

export const createBatchController = (prisma) => async (req, res) => {
    const { batch_name, subject, schedule, monthly_fee, teacher_id } = req.body;

    if (!String(batch_name || '').trim()) {
        return res.status(400).json({ error: 'batch_name is required.' });
    }

    if (!String(subject || '').trim()) {
        return res.status(400).json({ error: 'subject is required.' });
    }

    if (!String(schedule || '').trim()) {
        return res.status(400).json({ error: 'schedule cannot be empty.' });
    }

    if (!isPositiveOrZeroNumber(monthly_fee)) {
        return res.status(400).json({ error: 'monthly_fee must be greater than or equal to 0.' });
    }

    if (teacher_id && !isUuid(teacher_id)) {
        return res.status(400).json({ error: 'teacher_id must be a valid UUID or null.' });
    }

    try {
        const created = await createBatch(prisma, {
            batch_name,
            subject,
            schedule,
            monthly_fee,
            teacher_id
        });

        res.status(201).json(created);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'batch_name already exists.' });
        }

        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ error: error.message || 'Internal server error' });
    }
};

export const updateBatchController = (prisma) => async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) {
        return res.status(400).json({ error: 'Invalid batch id.' });
    }

    const { batch_name, subject, schedule, monthly_fee, teacher_id } = req.body;

    if (batch_name !== undefined && !String(batch_name || '').trim()) {
        return res.status(400).json({ error: 'batch_name cannot be empty.' });
    }

    if (subject !== undefined && !String(subject || '').trim()) {
        return res.status(400).json({ error: 'subject cannot be empty.' });
    }

    if (schedule !== undefined && !String(schedule || '').trim()) {
        return res.status(400).json({ error: 'schedule cannot be empty.' });
    }

    if (monthly_fee !== undefined && !isPositiveOrZeroNumber(monthly_fee)) {
        return res.status(400).json({ error: 'monthly_fee must be greater than or equal to 0.' });
    }

    if (teacher_id && !isUuid(teacher_id)) {
        return res.status(400).json({ error: 'teacher_id must be a valid UUID or null.' });
    }

    try {
        const updated = await updateBatch(prisma, id, {
            batch_name,
            subject,
            schedule,
            monthly_fee,
            teacher_id
        });

        res.json(updated);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Batch not found.' });
        }

        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'batch_name already exists.' });
        }

        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ error: error.message || 'Internal server error' });
    }
};

export const deleteBatchController = (prisma) => async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) {
        return res.status(400).json({ error: 'Invalid batch id.' });
    }

    try {
        await deleteBatch(prisma, id);
        res.json({ message: 'Batch deleted successfully.' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ error: error.message || 'Internal server error' });
    }
};
