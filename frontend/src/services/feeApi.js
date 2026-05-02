import { apiFetch } from './httpClient';

export const getAdminFeeDashboard = () => apiFetch('/admin/fees', { withAuth: true });

export const generateMonthlyDues = (asOfDate) =>
    apiFetch('/admin/fees/generate', {
        method: 'POST',
        body: asOfDate ? { as_of: asOfDate } : {},
        withAuth: true
    });

export const recordFeePayment = (payload) =>
    apiFetch('/admin/fees/pay', {
        method: 'POST',
        body: payload,
        withAuth: true
    });

export const getStudentFeeDashboard = () => apiFetch('/student/fees', { withAuth: true });
