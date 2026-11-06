import { Pool, type PoolClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

const databaseScope = new AsyncLocalStorage<Pool>();

/** Keep nested valuation queries on the outer transaction's connection. */
export function withDatabaseClient<T>(client: PoolClient, work: () => Promise<T>): Promise<T> {
  if (databaseScope.getStore()) throw new Error('Nested database scopes are not supported.');
  const scoped = new Proxy(getDb(), {
    get(pool, property) {
      if (property === 'query') return client.query.bind(client);
      if (property === 'connect' || property === 'end') {
        return () => { throw new Error('The outer transaction owns its database connection.'); };
      }
      const value = Reflect.get(pool, property, pool);
      return typeof value === 'function' ? value.bind(pool) : value;
    },
  });
  return databaseScope.run(scoped, work);
}

declare global {
  // eslint-disable-next-line no-var
  var aim4pricePool: Pool | undefined;
}

function createPool(): Pool {
  const hasPgParts =
    Boolean(process.env.PGHOST) &&
    Boolean(process.env.PGPORT) &&
    Boolean(process.env.PGUSER) &&
    Boolean(process.env.PGPASSWORD) &&
    Boolean(process.env.PGDATABASE);

  if (hasPgParts) {
    return new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: false,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      keepAlive: true,
    });
  }

  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      keepAlive: true,
    });
  }

  throw new Error(
    'Database connection variables are missing. Add PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE to the app service.'
  );
}

export function getDb(): Pool {
  const scoped = databaseScope.getStore();
  if (scoped) return scoped;
  if (!global.aim4pricePool) {
    global.aim4pricePool = createPool();
  }

  return global.aim4pricePool;
}
