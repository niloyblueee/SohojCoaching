import { apiFetch } from './httpClient';

export const getBatches = ({ search = '', sortBy = 'created_at', sortOrder = 'desc' } = {}) => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);

    const query = params.toString();
    return apiFetch(`/batches${query ? `?${query}` : ''}`, { withAuth: true });
};

export const getBatchById = (id) => apiFetch(`/batches/${id}`, { withAuth: true });

export const createBatch = (payload) =>
    apiFetch('/batches', {
        method: 'POST',
        body: payload,
        withAuth: true
    });

export const updateBatch = (id, payload) =>
    apiFetch(`/batches/${id}`, {
        method: 'PUT',
        body: payload,
        withAuth: true
    });

export const deleteBatch = (id) =>
    apiFetch(`/batches/${id}`, {
        method: 'DELETE',
        withAuth: true
    });

export const getTeachers = () => apiFetch('/teachers', { withAuth: true });

export const getBatchOverview = () => apiFetch('/batch-overview', { withAuth: true });
