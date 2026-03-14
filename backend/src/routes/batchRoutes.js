import { Router } from 'express';
import {
    createBatchController,
    deleteBatchController,
    getBatchByIdController,
    listBatchesController,
    updateBatchController
} from '../controllers/batchController.js';
import { requireAdmin, requireAnyRole, requireAuth } from '../middleware/auth.js';

export const createBatchRoutes = (prisma) => {
    const router = Router();

    router.get('/batches', requireAuth, requireAnyRole(['admin', 'teacher', 'student']), listBatchesController(prisma));
    router.get('/batches/:id', requireAuth, requireAnyRole(['admin', 'teacher', 'student']), getBatchByIdController(prisma));

    router.post('/batches', requireAuth, requireAdmin, createBatchController(prisma));
    router.put('/batches/:id', requireAuth, requireAdmin, updateBatchController(prisma));
    router.delete('/batches/:id', requireAuth, requireAdmin, deleteBatchController(prisma));

    return router;
};
