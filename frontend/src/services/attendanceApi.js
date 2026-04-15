import { apiFetch } from './httpClient';

const buildQuery = (params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        query.set(key, String(value));
    });

    const encoded = query.toString();
    return encoded ? `?${encoded}` : '';
};

export const getTeacherAttendanceAnalytics = ({ batch_id, student_id, days } = {}) => {
    const query = buildQuery({ batch_id, student_id, days });
    return apiFetch(`/attendance/teacher/analytics${query}`, { withAuth: true });
};

export const getStudentAttendanceAnalytics = ({ batch_id, days } = {}) => {
    const query = buildQuery({ batch_id, days });
    return apiFetch(`/attendance/student/analytics${query}`, { withAuth: true });
};

export const getSessionAttendance = (batchId, date) => {
    const query = buildQuery({ batch_id: batchId, date });
    return apiFetch(`/attendance/session${query}`, { withAuth: true });
};

export const saveSessionAttendance = (batchId, date, records) => {
    return apiFetch('/attendance/session', {
        method: 'POST',
        body: { batch_id: batchId, date, records },
        withAuth: true
    });
};
