// ============================================================
//  QUINIELA MUNDIALISTA — Backend (Node.js + Express)
//  File: backend/src/app.js
// ============================================================

import express           from 'express';
import cors              from 'cors';
import helmet            from 'helmet';
import rateLimit         from 'express-rate-limit';
import { authRouter }    from './routes/auth.js';
import { matchesRouter } from './routes/matches.js';
import { predictionsRouter } from './routes/predictions.js';
import { rankingRouter } from './routes/ranking.js';
import { adminRouter }   from './routes/admin.js';
import { errorHandler }  from './middleware/errorHandler.js';

const app = express();

// ── Security & middleware ─────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// Rate limiting global (anti-spam)
app.use(rateLimit({
    windowMs : 15 * 60 * 1000,  // 15 min
    max      : 200,
    message  : { error: 'Demasiadas solicitudes. Intenta más tarde.' }
}));

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',        authRouter);
app.use('/api/matches',     matchesRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/ranking',     rankingRouter);
app.use('/api/admin',       adminRouter);    // Protegido con rol admin

// ── Health check ─────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ──────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🏆 Quiniela API running on port ${PORT}`));

export default app;
