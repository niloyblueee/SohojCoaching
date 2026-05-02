import { apiFetch } from './httpClient';

export const getTeacherQuizzes = (batchId) => {
    const query = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : '';
    return apiFetch(`/teacher/quizzes${query}`, { withAuth: true });
};

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
