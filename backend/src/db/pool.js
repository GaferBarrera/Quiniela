// ============================================================
//  backend/src/db/pool.js
//  Singleton connection pool a PostgreSQL
// ============================================================

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    host     : process.env.DB_HOST     || 'localhost',
    port     : parseInt(process.env.DB_PORT || '5432'),
    database : process.env.DB_NAME     || 'quiniela_db',
    user     : process.env.DB_USER     || 'postgres',
    password : process.env.DB_PASSWORD,
    max      : 20,          // máx conexiones concurrentes
    idleTimeoutMillis : 30_000,
    connectionTimeoutMillis : 2_000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle DB client', err);
    process.exit(-1);
});
