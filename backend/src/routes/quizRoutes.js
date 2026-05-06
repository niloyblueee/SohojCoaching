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
    router.get('/batches/:id/leaderboard', requireAuth, requireAnyRole(['admin', 'teacher', 'student']), async (req, res) => {
    try {
        const { id } = req.params;
        const leaderboard = await prisma.$queryRaw`
            SELECT 
                u.id AS student_id,
                u.name AS student_name,
                COUNT(qa.id)::int AS graded_quizzes,
                COALESCE(SUM(qa.total_awarded_marks), 0)::int AS total_obtained_marks,
                COALESCE(SUM(qq.quiz_total), 0)::int AS total_full_marks,
                COALESCE(
                    ROUND((SUM(qa.total_awarded_marks)::numeric / NULLIF(SUM(qq.quiz_total), 0)::numeric) * 100, 2), 
                0)::float AS average_percentage
            FROM users u
            JOIN quiz_attempts qa ON u.id = qa.student_id
            JOIN quizzes q ON qa.quiz_id = q.id
            JOIN (
                SELECT quiz_id, SUM(marks) as quiz_total
                FROM quiz_questions
                GROUP BY quiz_id
            ) qq ON q.id = qq.quiz_id
            WHERE q.batch_id = CAST(${id} AS uuid)
              AND qa.status = 'submitted'
              AND qa.grading_status IN ('graded', 'completed')
            GROUP BY u.id, u.name
            ORDER BY total_obtained_marks DESC, average_percentage DESC;
        `;
        
        const formattedLeaderboard = leaderboard.map(student => ({
            ...student,
            graded_quizzes: Number(student.graded_quizzes),
            total_obtained_marks: Number(student.total_obtained_marks),
            total_full_marks: Number(student.total_full_marks),
            average_percentage: Number(student.average_percentage)
        }));

        res.json(formattedLeaderboard);
    } catch (err) {
        console.error("Leaderboard fetch error:", err);
        res.status(500).json({ error: "Failed to fetch leaderboard." });
    }
    });
    return router;
};
