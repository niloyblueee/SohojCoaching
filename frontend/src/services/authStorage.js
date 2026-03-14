import { AUTH_STORAGE_KEY } from '../config/appConfig';

export const getAuthSession = () => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed?.token || !parsed?.user) return null;
        return parsed;
    } catch {
        return null;
    }
};

export const getAuthToken = () => getAuthSession()?.token || null;

export const saveAuthSession = (session) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearAuthSession = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
};
