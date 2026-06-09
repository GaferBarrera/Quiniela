// ============================================================
//  backend/src/routes/matches.js
// ============================================================

import { Router }      from 'express';
import { pool }        from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const matchesRouter = Router();

// GET /api/matches — Lista todos los partidos con la
// predicción del usuario autenticado (si existe)
matchesRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT
                m.id, m.match_number, m.home_team, m.away_team,
                m.home_flag_emoji, m.away_flag_emoji,
                m.stage, m.match_start_utc,
                m.home_score_final, m.away_score_final, m.is_finished,
                (NOW() AT TIME ZONE 'UTC') >= m.match_start_utc AS is_locked,
                p.home_score_pred,
                p.away_score_pred,
                p.points_earned,
                p.submitted_at AS prediction_submitted_at
             FROM matches m
             LEFT JOIN predictions p
                ON p.match_id = m.id AND p.user_id = $1
             ORDER BY m.match_start_utc ASC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) { next(err); }
});
