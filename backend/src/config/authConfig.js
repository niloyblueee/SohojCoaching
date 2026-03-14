export const JWT_SECRET = process.env.JWT_SECRET || 'sohojcoaching-dev-jwt-secret-change-me';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const getAdminAccount = (index, fallback) => ({
    id: process.env[`ADMIN_${index}_ID`] || fallback.id,
    name: process.env[`ADMIN_${index}_NAME`] || fallback.name,
    email: process.env[`ADMIN_${index}_EMAIL`] || fallback.email,
    password: process.env[`ADMIN_${index}_PASSWORD`] || fallback.password
});

export const ADMIN_ACCOUNTS = [
    getAdminAccount(1, {
        id: 'admin-001',
        name: 'Admin One',
        email: 'change-admin1-email@example.com',
        password: 'change-admin1-password'
    }),
    getAdminAccount(2, {
        id: 'admin-002',
        name: 'Admin Two',
        email: 'change-admin2-email@example.com',
        password: 'change-admin2-password'
    }),
    getAdminAccount(3, {
        id: 'admin-003',
        name: 'Admin Three',
        email: 'change-admin3-email@example.com',
        password: 'change-admin3-password'
    })
];
