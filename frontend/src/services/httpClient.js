import { API_URL } from '../config/appConfig';
import { getAuthToken } from './authStorage';

export async function apiFetch(path, options = {}) {
    const {
        method = 'GET',
        headers = {},
        body,
        withAuth = false,
        authToken = null,
        baseUrl = API_URL
    } = options;

    const resolvedHeaders = { ...headers };

    if (withAuth) {
        const token = authToken || getAuthToken();
        if (token) {
            resolvedHeaders.Authorization = `Bearer ${token}`;
        }
    }

    let payloadBody = body;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    if (body && typeof body === 'object' && !isFormData) {
        resolvedHeaders['Content-Type'] = resolvedHeaders['Content-Type'] || 'application/json';
        payloadBody = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: resolvedHeaders,
        body: payloadBody
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
    }

    return payload;
}
