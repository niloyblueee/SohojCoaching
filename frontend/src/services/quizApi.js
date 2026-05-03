import { apiFetch } from './httpClient';

export const getTeacherQuizzes = (batchId) => {
    const query = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    return apiFetch(`/teacher/quizzes${query}`, { withAuth: true });
};

export const getTeacherQuizScripts = ({ batchId, quizId } = {}) => {
    const queryParts = [];
    if (batchId) queryParts.push(`batch_id=${encodeURIComponent(batchId)}`);
    if (quizId) queryParts.push(`quiz_id=${encodeURIComponent(quizId)}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    return apiFetch(`/teacher/quiz-scripts${query}`, { withAuth: true });
};

export const getTeacherQuizAttemptReview = (attemptId) =>
    apiFetch(`/teacher/quiz-attempts/${encodeURIComponent(attemptId)}/review`, { withAuth: true });

export const saveTeacherQuizAttemptReview = (attemptId, reviews) =>
    apiFetch(`/teacher/quiz-attempts/${encodeURIComponent(attemptId)}/review`, {
        method: 'POST',
        body: { reviews },
        withAuth: true
    });

export const createTeacherQuiz = (payload) =>
    apiFetch('/teacher/quizzes', {
        method: 'POST',
        body: payload,
        withAuth: true
    });

export const getStudentQuizzes = (batchId) => {
    const query = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    return apiFetch(`/student/quizzes${query}`, { withAuth: true });
};

export const getStudentResults = (batchId) => {
    const query = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    return apiFetch(`/student/results${query}`, { withAuth: true });
};

export const getStudentResultDetail = (attemptId) =>
    apiFetch(`/student/results/${encodeURIComponent(attemptId)}`, { withAuth: true });

export const startStudentQuizAttempt = (quizId) =>
    apiFetch(`/student/quizzes/${encodeURIComponent(quizId)}/attempts/start`, {
        method: 'POST',
        withAuth: true
    });

export const getStudentQuizAttempt = (attemptId) =>
    apiFetch(`/student/quiz-attempts/${encodeURIComponent(attemptId)}`, {
        withAuth: true
    });

export const submitStudentQuizAttempt = (attemptId, answers) =>
    apiFetch(`/student/quiz-attempts/${encodeURIComponent(attemptId)}/submit`, {
        method: 'POST',
        body: { answers },
        withAuth: true
    });
