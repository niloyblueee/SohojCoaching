import jwt from 'jsonwebtoken';
import { JWT_EXPIRES_IN, JWT_SECRET } from '../config/authConfig.js';

export const issueToken = (user) => {
    return jwt.sign(
        {
            sub: user.id,
            role: user.role,
            name: user.name,
            email: user.email
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

const getBearerToken = (req) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim();
};

export const requireAuth = (req, res, next) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authorization token is required.' });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.auth = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

export const requireAdmin = (req, res, next) => {
    if (!req.auth || req.auth.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
};
