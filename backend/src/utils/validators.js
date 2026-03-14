export const isUuid = (value) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
};

export const isEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
};

export const isStrongEnoughPassword = (value) => {
    return String(value || '').length >= 6;
};

export const normalizeRole = (value) => String(value || '').trim().toLowerCase();
