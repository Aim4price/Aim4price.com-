import { Pool } from 'pg';

const globalForDb = globalThis as typeof globalThis & {
  aim4pricePool?: Pool;
};

const requiredVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'] as const;

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`${key} is not set`);
  }
}

export const db =
  globalForDb.aim4pricePool ??
  new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.aim4pricePool = db;
}
