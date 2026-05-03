import { Router } from 'express';
import { requireAnyRole, requireAuth } from '../middleware/auth.js';
import {
    createQuizController,
    getStudentResultDetailController,
    getTeacherQuizAttemptReviewController,
    getStudentQuizAttemptController,
    getStudentResultsController,
    getStudentQuizzesController,
    getTeacherQuizScriptsController,
    getTeacherQuizzesController,
    saveTeacherQuizAttemptReviewController,
    startStudentQuizAttemptController,
    submitStudentQuizAttemptController
} from '../controllers/quizController.js';

export const createQuizRoutes = (prisma) => {
    const router = Router();
    router.use(requireAuth);

    router.get('/teacher/quizzes', requireAnyRole(['teacher', 'admin']), getTeacherQuizzesController(prisma));
    router.get('/teacher/quiz-scripts', requireAnyRole(['teacher', 'admin']), getTeacherQuizScriptsController(prisma));
    router.get(
        '/teacher/quiz-attempts/:attemptId/review',
        requireAnyRole(['teacher', 'admin']),
        getTeacherQuizAttemptReviewController(prisma)
    );
    router.post(
        '/teacher/quiz-attempts/:attemptId/review',
        requireAnyRole(['teacher', 'admin']),
        saveTeacherQuizAttemptReviewController(prisma)
    );
    router.post('/teacher/quizzes', requireAnyRole(['teacher', 'admin']), createQuizController(prisma));
    router.get('/student/quizzes', requireAnyRole(['student']), getStudentQuizzesController(prisma));
    router.get('/student/results', requireAnyRole(['student']), getStudentResultsController(prisma));
    router.get('/student/results/:attemptId', requireAnyRole(['student']), getStudentResultDetailController(prisma));
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
