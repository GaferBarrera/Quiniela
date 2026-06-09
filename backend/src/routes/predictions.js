// ============================================================
//  backend/src/routes/predictions.js
//  🔑 LÓGICA CORE: Bloqueo de tiempo + UPSERT de predicciones
// ============================================================

import { Router }      from 'express';
import { pool }        from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const predictionsRouter = Router();

// ── Todas las rutas requieren autenticación ───────────────
predictionsRouter.use(requireAuth);

// ============================================================
//  POST /api/predictions
//  Crea o actualiza (UPSERT) una predicción.
//
//  Body: { match_id, home_score_pred, away_score_pred }
// ============================================================
predictionsRouter.post('/', async (req, res, next) => {
    const { match_id, home_score_pred, away_score_pred } = req.body;
    const user_id = req.user.id;

    // ── Validación básica ─────────────────────────────────
    if (!match_id || home_score_pred == null || away_score_pred == null) {
        return res.status(400).json({ error: 'match_id, home_score_pred y away_score_pred son requeridos.' });
    }

    const home = parseInt(home_score_pred);
    const away = parseInt(away_score_pred);

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
        return res.status(400).json({ error: 'Los marcadores deben ser enteros no negativos.' });
    }

    try {
        // ── BLOQUEO DE TIEMPO (CRÍTICO) ───────────────────
        // Consultamos match_start_utc directamente en la BD.
        // Usamos NOW() del SERVIDOR de BD para evitar
        // manipulación desde el cliente.
        const lockCheck = await pool.query(
            `SELECT
                id,
                home_team,
                away_team,
                match_start_utc,
                is_finished,
                (NOW() AT TIME ZONE 'UTC') >= match_start_utc AS is_locked
             FROM matches
             WHERE id = $1`,
            [match_id]
        );

        if (lockCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Partido no encontrado.' });
        }

        const match = lockCheck.rows[0];

        // Partido ya iniciado o terminado → rechazar
        if (match.is_locked || match.is_finished) {
            return res.status(409).json({
                error   : 'No puedes modificar tu predicción. El partido ya comenzó.',
                locked_at: match.match_start_utc
            });
        }

        // ── UPSERT: INSERT o UPDATE si ya existe ──────────
        // ON CONFLICT respeta la constraint UNIQUE (user_id, match_id)
        const result = await pool.query(
            `INSERT INTO predictions
                 (user_id, match_id, home_score_pred, away_score_pred, submitted_at)
             VALUES ($1, $2, $3, $4, NOW() AT TIME ZONE 'UTC')
             ON CONFLICT (user_id, match_id) DO UPDATE
                 SET home_score_pred = EXCLUDED.home_score_pred,
                     away_score_pred = EXCLUDED.away_score_pred,
                     submitted_at    = EXCLUDED.submitted_at
             RETURNING *`,
            [user_id, match_id, home, away]
        );

        return res.status(200).json({
            message    : 'Pronóstico guardado.',
            prediction : result.rows[0]
        });

    } catch (err) {
        next(err);
    }
});

// ============================================================
//  GET /api/predictions/my
//  Devuelve todas las predicciones del usuario autenticado
//  junto con la info del partido (para mostrar en el dashboard)
// ============================================================
predictionsRouter.get('/my', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT
                p.id,
                p.home_score_pred,
                p.away_score_pred,
                p.points_earned,
                p.submitted_at,
                m.id              AS match_id,
                m.match_number,
                m.home_team,
                m.away_team,
                m.home_flag_emoji,
                m.away_flag_emoji,
                m.stage,
                m.match_start_utc,
                m.home_score_final,
                m.away_score_final,
                m.is_finished,
                (NOW() AT TIME ZONE 'UTC') >= m.match_start_utc AS is_locked
             FROM predictions p
             JOIN matches m ON m.id = p.match_id
             WHERE p.user_id = $1
             ORDER BY m.match_start_utc ASC`,
            [req.user.id]
        );

        res.json(rows);
    } catch (err) {
        next(err);
    }
});
