import { Router } from 'express';
import { requireAnyRole, requireAuth } from '../middleware/auth.js';
import {
    createQuizController,
    getStudentQuizAttemptController,
    getStudentQuizzesController,
    getTeacherQuizScriptsController,
    getTeacherQuizzesController,
    startStudentQuizAttemptController,
    submitStudentQuizAttemptController
} from '../controllers/quizController.js';

export const createQuizRoutes = (prisma) => {
    const router = Router();
    router.use(requireAuth);

    router.get('/teacher/quizzes', requireAnyRole(['teacher', 'admin']), getTeacherQuizzesController(prisma));
    router.get('/teacher/quiz-scripts', requireAnyRole(['teacher', 'admin']), getTeacherQuizScriptsController(prisma));
    router.post('/teacher/quizzes', requireAnyRole(['teacher', 'admin']), createQuizController(prisma));
    router.get('/student/quizzes', requireAnyRole(['student']), getStudentQuizzesController(prisma));
    router.post(
        '/student/quizzes/:quizId/attempts/start',
        requireAnyRole(['student']),
        startStudentQuizAttemptController(prisma)
    );
    router.get(
        '/student/quiz-attempts/:attemptId',
        requireAnyRole(['student']),
        getStudentQuizAttemptController(prisma)
    );
    router.post(
        '/student/quiz-attempts/:attemptId/submit',
        requireAnyRole(['student']),
        submitStudentQuizAttemptController(prisma)
    );

    return router;
};
