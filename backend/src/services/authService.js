import bcrypt from 'bcryptjs';
import { ADMIN_ACCOUNTS } from '../config/authConfig.js';

const APP_ROLES = {
    admin: 'admin',
    student: 'student',
    teacher: 'teacher'
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const buildRedirectPath = (role) => {
    if (role === APP_ROLES.admin) return '/admin/management';
    if (role === APP_ROLES.teacher) return '/teacher/materials';
    return '/student/materials';
};

const toPublicUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: String(user.role).toLowerCase()
});

export const resolveLoginUser = async (prisma, { role, email, password }) => {
    const normalizedRole = normalizeRole(role);
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (normalizedRole === APP_ROLES.admin) {
        const admin = ADMIN_ACCOUNTS.find(
            (account) => account.email.toLowerCase() === normalizedEmail && account.password === String(password)
        );

        if (!admin) return null;

        return {
            user: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: APP_ROLES.admin
            },
            redirectTo: buildRedirectPath(APP_ROLES.admin)
        };
    }

    if (normalizedRole !== APP_ROLES.student && normalizedRole !== APP_ROLES.teacher) {
        return null;
    }

    const dbUser = await prisma.user.findFirst({
        where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            role: { equals: normalizedRole, mode: 'insensitive' }
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            passwordHash: true
        }
    });

    if (!dbUser?.passwordHash) return null;

    const passwordMatches = await bcrypt.compare(String(password), dbUser.passwordHash);
    if (!passwordMatches) return null;

    const user = toPublicUser(dbUser);

    return {
        user,
        redirectTo: buildRedirectPath(user.role)
    };
};

export const signupUser = async (prisma, { role, name, email, password }) => {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole !== APP_ROLES.student && normalizedRole !== APP_ROLES.teacher) {
        const error = new Error('Signup is supported for student and teacher roles only.');
        error.statusCode = 403;
        throw error;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const created = await prisma.user.create({
        data: {
            name: String(name).trim(),
            email: String(email).trim().toLowerCase(),
            role: normalizedRole,
            passwordHash
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true
        }
    });

    const user = toPublicUser(created);

    return {
        user,
        redirectTo: buildRedirectPath(user.role)
    };
};
