import { Router } from 'express';
import { requireAdmin, requireAnyRole, requireAuth } from '../middleware/auth.js';
import {
    generateMonthlyFeesController,
    getAdminFeesController,
    getStudentFeesController,
    recordPaymentController
} from '../controllers/feeController.js';

export const createFeeRoutes = (prisma) => {
    const router = Router();
    router.use(requireAuth);

    router.get('/admin/fees', requireAdmin, getAdminFeesController(prisma));
    router.post('/admin/fees/generate', requireAdmin, generateMonthlyFeesController(prisma));
    router.post('/admin/fees/pay', requireAdmin, recordPaymentController(prisma));
    router.get('/student/fees', requireAnyRole(['student']), getStudentFeesController(prisma));

    return router;
};
