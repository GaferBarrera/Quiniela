// ============================================================
//  backend/src/routes/auth.js
// ============================================================

import { Router }               from 'express';
import bcrypt                   from 'bcrypt';
import { pool }                 from '../db/pool.js';
import { signToken }            from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req, res, next) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email y password son requeridos.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    try {
        const hash = await bcrypt.hash(password, 12);
        const { rows } = await pool.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, role`,
            [username.trim(), email.toLowerCase().trim(), hash]
        );
        const token = signToken({ id: rows[0].id, username: rows[0].username, role: rows[0].role });
        res.status(201).json({ user: rows[0], token });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'El usuario o email ya está registrado.' });
        next(err);
    }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email y password requeridos.' });
    try {
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
        );
        if (rows.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas.' });

        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas.' });

        const token = signToken({ id: rows[0].id, username: rows[0].username, role: rows[0].role });
        res.json({
            user  : { id: rows[0].id, username: rows[0].username, email: rows[0].email, role: rows[0].role },
            token
        });
    } catch (err) { next(err); }
});
