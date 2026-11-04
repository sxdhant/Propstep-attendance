/**
 * Local development database: a real PostgreSQL server (embedded binaries),
 * so nothing has to be installed. Data lives in .data/pg. Not for production.
 *   npm run db:dev
 */
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const dir = ".data/pg";
const port = Number(process.env.DEV_DB_PORT ?? 54329);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });

const fresh = !existsSync(`${dir}/PG_VERSION`);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("attendance");
console.log(`Postgres ready: postgres://postgres:postgres@localhost:${port}/attendance`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
