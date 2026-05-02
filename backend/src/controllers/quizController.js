import { createQuiz, getStudentQuizzes, getTeacherQuizzes } from '../services/quizService.js';

export const createQuizController = (prisma) => async (req, res) => {
    try {
        const payload = await createQuiz(prisma, {
            requesterId: req.auth?.sub,
            requesterRole: req.auth?.role,
            batchId: req.body?.batch_id,
            title: req.body?.title,
            description: req.body?.description,
            availabilityType: req.body?.availability_type,
            startsAt: req.body?.starts_at,
            durationMinutes: req.body?.duration_minutes,
            attemptMode: req.body?.attempt_mode,
            questions: req.body?.questions
        });

        return res.status(201).json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to create quiz.' });
    }
};

export const getTeacherQuizzesController = (prisma) => async (req, res) => {
    try {
        const payload = await getTeacherQuizzes(prisma, {
            requesterId: req.auth?.sub,
            requesterRole: req.auth?.role,
            batchId: req.query?.batch_id
        });

        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to fetch quizzes.' });
    }
};

export const getStudentQuizzesController = (prisma) => async (req, res) => {
    try {
        const payload = await getStudentQuizzes(prisma, {
            studentId: req.auth?.sub,
            batchId: req.query?.batch_id
        });

        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to fetch student quizzes.' });
    }
};
