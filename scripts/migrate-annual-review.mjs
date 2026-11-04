// Idempotent startup migration; failure stops startup rather than exposing a broken save flow.
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
const hasParts = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].every(key => process.env[key]);
if (!hasParts && !process.env.DATABASE_URL) throw new Error('Database configuration missing');
const pool = new Pool(hasParts ? {
  host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER,
  password: process.env.PGPASSWORD, database: process.env.PGDATABASE, ssl: false, connectionTimeoutMillis: 10000,
} : { connectionString: process.env.DATABASE_URL, ssl: false, connectionTimeoutMillis: 10000 });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='10s'");
  await client.query("SET LOCAL statement_timeout='60s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('annual-review-schema'))");
  await client.query(await readFile(new URL('../database/migrations/151-annual-asset-reviews.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Annual review schema is ready.');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error('Annual review migration failed. Startup stopped.');
  process.exitCode = 1;
} finally { client?.release(); await pool.end(); }
