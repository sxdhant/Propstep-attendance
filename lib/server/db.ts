import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { pgOptions } from "@/lib/db-config";
import { env } from "@/lib/server/env";

// Keep calendar dates as plain "YYYY-MM-DD" strings (the app's DateKey), not JS Dates.
types.setTypeParser(1082, (value) => value);
// numeric -> number (salaries fit comfortably in a double).
types.setTypeParser(1700, (value) => Number(value));

const globalForPool = globalThis as unknown as { __pgPool?: Pool };

export function getPool(): Pool {
  if (!globalForPool.__pgPool) {
    globalForPool.__pgPool = new Pool({
      ...pgOptions(env.databaseUrl, env.databaseSsl),
      // Keep this small behind a connection pooler (Supabase pooler, Neon -pooler host).
      max: env.databasePoolMax,
      idleTimeoutMillis: 30_000,
      // Serverless hosts (Neon) may need a few seconds to wake an idle database.
      connectionTimeoutMillis: 15_000,
      statement_timeout: 15_000,
    });
    globalForPool.__pgPool.on("error", (error) => console.error("Postgres pool error", error.message));
  }
  return globalForPool.__pgPool;
}

export type Queryable = Pick<PoolClient, "query">;

/** Always use parameters ($1, $2 ...): values are never concatenated into SQL. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  db: Queryable = getPool(),
): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  db: Queryable = getPool(),
): Promise<T | null> {
  return (await query<T>(sql, params, db))[0] ?? null;
}

/** Runs `fn` in a transaction; any thrown error rolls everything back. */
export async function transaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
