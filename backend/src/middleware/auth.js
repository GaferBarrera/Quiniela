// ============================================================
//  backend/src/middleware/auth.js
//  JWT verification + role guard
// ============================================================

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIA_ESTO_EN_PRODUCCION';

/**
 * Verifica el JWT en Authorization: Bearer <token>
 * Adjunta req.user = { id, username, role }
 */
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token requerido.' });
    }

    const token = header.split(' ')[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

/**
 * Verifica que el usuario autenticado tenga rol 'admin'.
 * Debe usarse DESPUÉS de requireAuth.
 */
export function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso restringido a administradores.' });
    }
    next();
}

export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}