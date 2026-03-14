import { Router } from 'express';
import { ADMIN_ACCOUNTS } from '../config/authConfig.js';
import { issueToken, requireAuth } from '../middleware/auth.js';

const authRoutes = Router();

authRoutes.post('/login', async (req, res) => {
    const { role, email, password } = req.body;

    if (!role || !email || !password) {
        return res.status(400).json({ error: 'role, email, and password are required.' });
    }

    if (String(role).toLowerCase() !== 'admin') {
        return res.status(403).json({ error: 'JWT login is currently enabled for admin accounts only.' });
    }

    const admin = ADMIN_ACCOUNTS.find(
        (account) => account.email.toLowerCase() === String(email).toLowerCase() && account.password === String(password)
    );

    if (!admin) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const user = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin'
    };

    const token = issueToken(user);

    return res.json({
        token,
        user,
        redirectTo: '/admin/management'
    });
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

export default authRoutes;
