import {
    createQuiz,
    getStudentResultDetail,
    getStudentResults,
    getStudentQuizAttempt,
    getStudentQuizzes,
    getTeacherQuizAttemptReview,
    getTeacherQuizScripts,
    getTeacherQuizzes,
    saveTeacherQuizAttemptReview,
    startQuizAttempt,
    submitQuizAttempt
} from '../services/quizService.js';

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
            entryCloseAt: req.body?.entry_close_at,
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

export const getStudentResultsController = (prisma) => async (req, res) => {
    try {
        const payload = await getStudentResults(prisma, {
            studentId: req.auth?.sub,
            batchId: req.query?.batch_id
        });

        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to load student results.' });
    }
};

export const getStudentResultDetailController = (prisma) => async (req, res) => {
    try {
        const payload = await getStudentResultDetail(prisma, {
            studentId: req.auth?.sub,
            attemptId: req.params?.attemptId
        });

        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to load result detail.' });
    }
};

export const getTeacherQuizScriptsController = (prisma) => async (req, res) => {
    try {
        const payload = await getTeacherQuizScripts(prisma, {
            requesterId: req.auth?.sub,
            requesterRole: req.auth?.role,
            batchId: req.query?.batch_id,
            quizId: req.query?.quiz_id
        });

        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to fetch quiz scripts.' });
    }
};

export const startStudentQuizAttemptController = (prisma) => async (req, res) => {
    try {
        const payload = await startQuizAttempt(prisma, {
            studentId: req.auth?.sub,
            quizId: req.params?.quizId
        });
        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to start quiz attempt.' });
    }
};

export const getTeacherQuizAttemptReviewController = (prisma) => async (req, res) => {
    try {
        const payload = await getTeacherQuizAttemptReview(prisma, {
            requesterId: req.auth?.sub,
            requesterRole: req.auth?.role,
            attemptId: req.params?.attemptId
        });
        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to load quiz script review.' });
    }
};

export const saveTeacherQuizAttemptReviewController = (prisma) => async (req, res) => {
    try {
        const payload = await saveTeacherQuizAttemptReview(prisma, {
            requesterId: req.auth?.sub,
            requesterRole: req.auth?.role,
            attemptId: req.params?.attemptId,
            reviews: req.body?.reviews
        });
        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to save quiz script review.' });
    }
};

export const getStudentQuizAttemptController = (prisma) => async (req, res) => {
    try {
        const payload = await getStudentQuizAttempt(prisma, {
            studentId: req.auth?.sub,
            attemptId: req.params?.attemptId
        });
        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to load quiz attempt.' });
    }
};

export const submitStudentQuizAttemptController = (prisma) => async (req, res) => {
    try {
        const payload = await submitQuizAttempt(prisma, {
            studentId: req.auth?.sub,
            attemptId: req.params?.attemptId,
            answers: req.body?.answers
        });
        return res.json(payload);
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ error: error.message || 'Failed to submit quiz attempt.' });
    }
};
