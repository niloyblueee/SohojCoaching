import { Router } from 'express';
import { requireAnyRole, requireAuth } from '../middleware/auth.js';
import {
    createQuizController,
    getStudentQuizzesController,
    getTeacherQuizzesController
} from '../controllers/quizController.js';

export const createQuizRoutes = (prisma) => {
    const router = Router();
    router.use(requireAuth);

    router.get('/teacher/quizzes', requireAnyRole(['teacher', 'admin']), getTeacherQuizzesController(prisma));
    router.post('/teacher/quizzes', requireAnyRole(['teacher', 'admin']), createQuizController(prisma));
    router.get('/student/quizzes', requireAnyRole(['student']), getStudentQuizzesController(prisma));

    return router;
};
