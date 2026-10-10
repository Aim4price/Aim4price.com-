// Railway pre-deploy step. Applies only the reviewed AI security metadata migrations.
// Never run migrations or business-schema initialisation from an AI request.
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";
const hasParts = [
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
].every((k) => process.env[k]);
const pool = new Pool(
  hasParts
    ? {
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: false,
        connectionTimeoutMillis: 10000,
      }
    : {
        connectionString: process.env.DATABASE_URL,
        ssl: false,
        connectionTimeoutMillis: 10000,
      },
);
let db;
try {
  if (!hasParts && !process.env.DATABASE_URL)
    throw new Error("Database configuration missing");
  db = await pool.connect();
  await db.query("BEGIN");
  await db.query("SET LOCAL lock_timeout='10s'");
  await db.query("SET LOCAL statement_timeout='60s'");
  await db.query("SELECT pg_advisory_xact_lock(1370137)");
  await db.query(
    "CREATE TABLE IF NOT EXISTS public.ai_connection_schema_versions(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const filename of [
    "135-read-only-ai-connections.sql",
    "137-ai-provider-admin-reporting.sql",
  ]) {
    if (
      (
        await db.query(
          "SELECT version FROM public.ai_connection_schema_versions WHERE version=$1",
          [filename],
        )
      ).rowCount
    )
      continue;
    const sql = await readFile(
      fileURLToPath(
        new URL("../database/migrations/" + filename, import.meta.url),
      ),
      "utf8",
    );
    await db.query(
      sql.replace(/^BEGIN;\s*$/gm, "").replace(/^COMMIT;\s*$/gm, ""),
    );
    await db.query(
      "INSERT INTO public.ai_connection_schema_versions(version) VALUES($1)",
      [filename],
    );
    console.log("Applied AI security migration: " + filename);
  }
  // Bounded metadata retention; never touches customer business records.
  await db.query(
    "DELETE FROM public.ai_connection_codes WHERE expires_at<now()-interval '1 day'",
  );
  await db.query(
    "DELETE FROM public.ai_connections WHERE expires_at<now()-interval '30 days' OR revoked_at<now()-interval '30 days'",
  );
  await db.query(
    "DELETE FROM public.ai_connection_rate_limits WHERE window_start<now()-interval '7 days'",
  );
  await db.query(
    "DELETE FROM public.ai_connection_audit WHERE created_at<now()-interval '90 days'",
  );
  await db.query("COMMIT");
  console.log("AI connection security schema is ready.");
} catch {
  if (db) await db.query("ROLLBACK").catch(() => {});
  console.error(
    "AI security migration failed. Deployment stopped; check database connectivity and schema.",
  );
  process.exitCode = 1;
} finally {
  db?.release();
  await pool.end();
}
