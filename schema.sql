-- ============================================================
--  QUINIELA MUNDIALISTA — PostgreSQL Schema
--  Run this file once against your DB to initialize.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(50) NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT       NOT NULL,
    role        VARCHAR(10)  NOT NULL DEFAULT 'player'
                             CHECK (role IN ('player', 'admin')),
    total_points   INT        NOT NULL DEFAULT 0,
    exact_score_count INT     NOT NULL DEFAULT 0,  -- Desempate: aciertos exactos
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: matches
-- ============================================================
CREATE TABLE matches (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    match_number    INT         NOT NULL UNIQUE,  -- Ej: Partido 1, Partido 2...
    home_team       VARCHAR(80) NOT NULL,
    away_team       VARCHAR(80) NOT NULL,
    home_flag_emoji VARCHAR(10),                  -- Ej: '🇦🇷'
    away_flag_emoji VARCHAR(10),
    stage           VARCHAR(50) NOT NULL DEFAULT 'Group',  -- Group, Round of 16, QF, SF, Final
    match_start_utc TIMESTAMPTZ NOT NULL,         -- CRÍTICO: hora UTC de inicio

    -- Resultado final (NULL hasta que el Admin lo cargue)
    home_score_final INT        DEFAULT NULL,
    away_score_final INT        DEFAULT NULL,
    is_finished      BOOLEAN    NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_start ON matches (match_start_utc);

-- ============================================================
-- TABLE: predictions
-- ============================================================
CREATE TABLE predictions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    match_id        UUID        NOT NULL REFERENCES matches(id)  ON DELETE CASCADE,

    home_score_pred INT         NOT NULL CHECK (home_score_pred >= 0),
    away_score_pred INT         NOT NULL CHECK (away_score_pred >= 0),

    -- Calculado automáticamente cuando Admin sube resultado
    points_earned   INT         NOT NULL DEFAULT 0
                                CHECK (points_earned IN (0, 1, 2)),

    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un usuario solo puede tener una predicción por partido
    CONSTRAINT uq_user_match UNIQUE (user_id, match_id)
);

CREATE INDEX idx_predictions_user    ON predictions (user_id);
CREATE INDEX idx_predictions_match   ON predictions (match_id);

-- ============================================================
-- VIEW: ranking — calcula el ranking en tiempo real
-- ============================================================
CREATE OR REPLACE VIEW ranking AS
SELECT
    u.id,
    u.username,
    u.total_points,
    u.exact_score_count,
    RANK() OVER (
        ORDER BY
            u.total_points       DESC,
            u.exact_score_count  DESC,
            u.username           ASC          -- Desempate final: alfabético
    ) AS position
FROM users u
WHERE u.role = 'player';

-- ============================================================
-- FUNCTION + TRIGGER: recalculate_points_on_result()
-- Se dispara automáticamente cuando un admin actualiza
-- home_score_final / away_score_final de un partido.
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_points_on_result()
RETURNS TRIGGER AS $$
DECLARE
    pred        RECORD;
    pts         INT;
    is_exact    BOOLEAN;
    -- Resultado real
    real_home   INT := NEW.home_score_final;
    real_away   INT := NEW.away_score_final;
    real_winner VARCHAR(4);  -- 'home' | 'away' | 'draw'
BEGIN
    -- Solo procesar cuando el partido se marca como terminado
    IF NEW.is_finished = FALSE OR real_home IS NULL OR real_away IS NULL THEN
        RETURN NEW;
    END IF;

    -- Determinar ganador real
    IF    real_home > real_away THEN real_winner := 'home';
    ELSIF real_away > real_home THEN real_winner := 'away';
    ELSE                             real_winner := 'draw';
    END IF;

    -- Resetear los puntos de ESTE partido antes de recalcular
    -- (por si el admin corrige un resultado ya cargado)
    UPDATE predictions
    SET    points_earned = 0
    WHERE  match_id = NEW.id;

    -- Recalcular predicción por predicción
    FOR pred IN
        SELECT * FROM predictions WHERE match_id = NEW.id
    LOOP
        pts      := 0;
        is_exact := FALSE;

        -- ¿Acertó el marcador exacto? → 2 puntos
        IF pred.home_score_pred = real_home
           AND pred.away_score_pred = real_away THEN
            pts      := 2;
            is_exact := TRUE;
        ELSE
            -- ¿Acertó solo el resultado (G/E/P)? → 1 punto
            DECLARE pred_winner VARCHAR(4);
            BEGIN
                IF    pred.home_score_pred > pred.away_score_pred THEN pred_winner := 'home';
                ELSIF pred.away_score_pred > pred.home_score_pred THEN pred_winner := 'away';
                ELSE                                                    pred_winner := 'draw';
                END IF;

                IF pred_winner = real_winner THEN
                    pts := 1;
                END IF;
            END;
        END IF;

        -- Actualizar puntos en la predicción
        UPDATE predictions
        SET    points_earned = pts
        WHERE  id = pred.id;

        -- Actualizar contador global del usuario
        UPDATE users
        SET
            total_points      = total_points      + pts,
            exact_score_count = exact_score_count + (CASE WHEN is_exact THEN 1 ELSE 0 END)
        WHERE id = pred.user_id;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger se activa al hacer UPDATE en matches
CREATE TRIGGER trg_recalculate_points
AFTER UPDATE OF home_score_final, away_score_final, is_finished
ON matches
FOR EACH ROW
EXECUTE FUNCTION recalculate_points_on_result();
