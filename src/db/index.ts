import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arkDb?: NodePgDatabase;
};

function getDb(): NodePgDatabase {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!globalForDb.__arkDb) {
    const pool =
      globalForDb.__arenaNextJsPostgresqlPool ??
      new Pool({ connectionString: databaseUrl });
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__arenaNextJsPostgresqlPool = pool;
    }
    globalForDb.__arkDb = drizzle(pool);
  }
  return globalForDb.__arkDb;
}

// Lazy proxy so importing this module never throws when DATABASE_URL is unset
// (e.g. /api/health reports database: unavailable instead of crashing).
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { getDb };

// Backward-compatible pool accessor (lazy).
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    getDb();
    const real = globalForDb.__arenaNextJsPostgresqlPool;
    if (!real) throw new Error('DATABASE_URL is required');
    const value = Reflect.get(real as object, prop);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
