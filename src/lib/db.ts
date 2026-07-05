import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Returns a query function, or null if no database is configured.
// This lets the whole app degrade gracefully: without DATABASE_URL the
// tracker falls back to browser storage and geocoding skips its cache.
let _sql: NeonQueryFunction<false, false> | null | undefined;

export function getSql(): NeonQueryFunction<false, false> | null {
  if (_sql !== undefined) return _sql;
  const url = process.env.DATABASE_URL;
  _sql = url ? neon(url) : null;
  return _sql;
}

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Create tables if they don't exist. Idempotent and cheap. Guarded so it
// only runs once per warm serverless instance.
let _initialized = false;

export async function ensureSchema(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  if (_initialized) return true;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id            BIGSERIAL PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS saved_jobs (
        id         BIGSERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        job_id     TEXT NOT NULL,
        job_data   JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, job_id)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS geocode_cache (
        query TEXT PRIMARY KEY,
        lat   DOUBLE PRECISION NOT NULL,
        lng   DOUBLE PRECISION NOT NULL,
        city  TEXT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ai_cache (
        cache_key  TEXT PRIMARY KEY,
        content    TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    _initialized = true;
    return true;
  } catch {
    return false;
  }
}

// CV table is isolated because it depends on the pgvector extension. Keeping it
// separate means a missing extension can't break the core tables above.
let _cvInitialized = false;

export async function ensureCvSchema(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  if (_cvInitialized) return true;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_cv (
        user_id    TEXT PRIMARY KEY,
        cv_text    TEXT NOT NULL,
        embedding  vector(768),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    _cvInitialized = true;
    return true;
  } catch {
    return false;
  }
}
