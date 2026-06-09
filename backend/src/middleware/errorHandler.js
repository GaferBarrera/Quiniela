// ============================================================
//  backend/src/middleware/errorHandler.js
// ============================================================

export function errorHandler(err, _req, res, _next) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
}
