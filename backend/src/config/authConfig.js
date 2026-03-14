export const JWT_SECRET = process.env.JWT_SECRET || 'sohojcoaching-dev-jwt-secret-change-me';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Demo-only static admin identities for current phase.
// Next phase will move to DB-backed credentials for all roles.
export const ADMIN_ACCOUNTS = [
    {
        id: 'admin-001',
        name: 'Admin One',
        email: 'admin1@sohojcoaching.com',
        password: 'Admin123!'
    },
    {
        id: 'admin-002',
        name: 'Admin Two',
        email: 'admin2@sohojcoaching.com',
        password: 'Admin123!'
    },
    {
        id: 'admin-003',
        name: 'Admin Three',
        email: 'admin3@sohojcoaching.com',
        password: 'Admin123!'
    }
];
