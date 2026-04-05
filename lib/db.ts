import { Pool } from 'pg';

const globalForDb = globalThis as typeof globalThis & {
  aim4pricePool?: Pool;
};

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const db =
  globalForDb.aim4pricePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.aim4pricePool = db;
}
