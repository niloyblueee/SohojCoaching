import { apiFetch } from './httpClient';

export const login = ({ role, email, password }) => {
    return apiFetch('/auth/login', {
        method: 'POST',
        body: { role, email, password }
    });
};

export const signup = ({ role, name, email, password }) => {
    return apiFetch('/auth/signup', {
        method: 'POST',
        body: { role, name, email, password }
    });
};

export const getCurrentUser = (token) => {
    return apiFetch('/auth/me', {
        withAuth: true,
        authToken: token
    });
};
