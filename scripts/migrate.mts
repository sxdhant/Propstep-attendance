/**
 * Applies pending SQL files from db/migrations in order, each in a transaction.
 *   npm run db:migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import "./load-env.mts";
import pg from "pg";
import { adminDatabaseUrl, pgOptions } from "../lib/db-config";

const client = new pg.Client(pgOptions(adminDatabaseUrl()));
await client.connect();

await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name as string));
const dir = join(process.cwd(), "db", "migrations");

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  console.log(`Applying ${file}`);
  try {
    await client.query("BEGIN");
    await client.query(readFileSync(join(dir, file), "utf8"));
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`Migration ${file} failed:`, error);
    process.exit(1);
  }
}
console.log("Database is up to date.");
await client.end();
