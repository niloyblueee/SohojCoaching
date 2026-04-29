import { Router } from 'express';
import { issueToken, requireAuth } from '../middleware/auth.js';
import { isEmail, isStrongEnoughPassword, normalizeRole } from '../utils/validators.js';
import { resolveLoginUser, signupUser } from '../services/authService.js';

export const createAuthRoutes = (prisma) => {
    const authRoutes = Router();

    authRoutes.post('/login', async (req, res) => {
        try {
            const { role, email, password } = req.body;

            if (!role || !email || !password) {
                return res.status(400).json({ error: 'role, email, and password are required.' });
            }

            if (!isEmail(email)) {
                return res.status(400).json({ error: 'A valid email is required.' });
            }

            const normalizedRole = normalizeRole(role);

            if (!['admin', 'student', 'teacher'].includes(normalizedRole)) {
                return res.status(400).json({ error: 'Invalid role. Supported roles: admin, teacher, student.' });
            }

            const loginResult = await resolveLoginUser(prisma, {
                role: normalizedRole,
                email,
                password
            });

            if (!loginResult) {
                return res.status(401).json({ error: 'Invalid credentials.' });
            }

            const token = issueToken(loginResult.user);

            return res.json({
                token,
                user: loginResult.user,
                redirectTo: loginResult.redirectTo
            });
        } catch (error) {
            const statusCode = error.statusCode || 500;
            return res.status(statusCode).json({
                error: error.message || 'Internal server error',
                details: statusCode === 500 ? error.message : undefined
            });
        }
    });

    authRoutes.post('/signup', async (req, res) => {
        const { role, name, email, password } = req.body;

        if (!role || !name || !email || !password) {
            return res.status(400).json({ error: 'role, name, email, and password are required.' });
        }

        if (!isEmail(email)) {
            return res.status(400).json({ error: 'A valid email is required.' });
        }

        if (!isStrongEnoughPassword(password)) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        if (!String(name).trim()) {
            return res.status(400).json({ error: 'Name cannot be empty.' });
        }

        try {
            const signupResult = await signupUser(prisma, {
                role: normalizeRole(role),
                name,
                email,
                password
            });

            const token = issueToken(signupResult.user);

            return res.status(201).json({
                token,
                user: signupResult.user,
                redirectTo: signupResult.redirectTo
            });
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(409).json({ error: 'Email is already registered.' });
            }

            const statusCode = error.statusCode || 500;
            return res.status(statusCode).json({
                error: error.message || 'Internal server error',
                details: statusCode === 500 ? error.message : undefined
            });
        }
    });

    authRoutes.get('/me', requireAuth, (req, res) => {
        res.json({
            user: {
                id: req.auth.sub,
                name: req.auth.name,
                email: req.auth.email,
                role: req.auth.role
            }
        });
    });

    return authRoutes;
};
