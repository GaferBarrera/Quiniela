// ============================================================
//  backend/src/routes/ranking.js
// ============================================================

import { Router }      from 'express';
import { pool }        from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const rankingRouter = Router();

// GET /api/ranking
rankingRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM ranking ORDER BY position ASC'
        );
        res.json(rows);
    } catch (err) { next(err); }
});
