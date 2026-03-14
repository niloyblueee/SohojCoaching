export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const API_URL = `${BASE_URL}/api`;
export const AUTH_STORAGE_KEY = 'sohojcoaching_auth';
