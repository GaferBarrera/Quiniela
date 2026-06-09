// ============================================================
//  backend/src/routes/admin.js
//  Endpoint protegido para actualizar resultados reales.
//  El trigger SQL recalcula puntos automáticamente.
// ============================================================

import { Router }                  from 'express';
import { pool }                    from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const adminRouter = Router();

// Todas las rutas admin requieren JWT válido + rol admin
adminRouter.use(requireAuth, requireAdmin);

// ============================================================
//  PATCH /api/admin/matches/:id/result
//  Actualiza el resultado final de un partido.
//
//  Body: { home_score_final, away_score_final }
//
//  ⚡ Esto dispara el TRIGGER trg_recalculate_points en la BD,
//     que recalcula puntos de TODOS los usuarios automáticamente.
// ============================================================
adminRouter.patch('/matches/:id/result', async (req, res, next) => {
    const { id } = req.params;
    const { home_score_final, away_score_final } = req.body;

    if (home_score_final == null || away_score_final == null) {
        return res.status(400).json({ error: 'home_score_final y away_score_final son requeridos.' });
    }

    const home = parseInt(home_score_final);
    const away = parseInt(away_score_final);

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
        return res.status(400).json({ error: 'Los marcadores deben ser enteros no negativos.' });
    }

    try {
        // ── Verificar que el partido existe ───────────────
        const matchCheck = await pool.query(
            'SELECT id, home_team, away_team FROM matches WHERE id = $1',
            [id]
        );
        if (matchCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Partido no encontrado.' });
        }

        // ── Actualizar resultado + marcar como terminado ──
        // El TRIGGER recalcula puntos automáticamente aquí.
        // Si el admin corrige el resultado, el trigger también
        // maneja el reset y re-cálculo (ver schema.sql).
        const { rows } = await pool.query(
            `UPDATE matches
             SET
                 home_score_final = $1,
                 away_score_final = $2,
                 is_finished      = TRUE
             WHERE id = $3
             RETURNING *`,
            [home, away, id]
        );

        // ── Consultar cuántos puntos se distribuyeron ─────
        const stats = await pool.query(
            `SELECT
                COUNT(*)                            AS total_predictions,
                COUNT(*) FILTER (WHERE points_earned = 2) AS exact_hits,
                COUNT(*) FILTER (WHERE points_earned = 1) AS result_hits,
                COUNT(*) FILTER (WHERE points_earned = 0) AS misses
             FROM predictions
             WHERE match_id = $1`,
            [id]
        );

        res.json({
            message : '✅ Resultado guardado. Puntos recalculados automáticamente.',
            match   : rows[0],
            stats   : stats.rows[0]
        });

    } catch (err) {
        next(err);
    }
});

// ============================================================
//  POST /api/admin/matches
//  Crear un nuevo partido (para cargar el fixture)
// ============================================================
adminRouter.post('/matches', async (req, res, next) => {
    const {
        match_number, home_team, away_team,
        home_flag_emoji, away_flag_emoji,
        stage, match_start_utc
    } = req.body;

    if (match_number == null || match_number === '' || !home_team || !away_team || !match_start_utc) {
        return res.status(400).json({ error: 'match_number, home_team, away_team y match_start_utc son requeridos.' });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO matches
                 (match_number, home_team, away_team,
                  home_flag_emoji, away_flag_emoji, stage, match_start_utc)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING *`,
            [match_number, home_team, away_team,
             home_flag_emoji, away_flag_emoji, stage, match_start_utc]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') {  // unique_violation
            return res.status(409).json({ error: `El partido número ${match_number} ya existe.` });
        }
        next(err);
    }
});

// ============================================================
//  GET /api/admin/matches  — listado con stats
// ============================================================
adminRouter.get('/matches', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT
                m.*,
                COUNT(p.id) AS prediction_count
             FROM matches m
             LEFT JOIN predictions p ON p.match_id = m.id
             GROUP BY m.id
             ORDER BY m.match_start_utc ASC`
        );
        res.json(rows);
    } catch (err) {
        next(err);
    }
});