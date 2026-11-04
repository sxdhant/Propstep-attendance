/**
 * Housekeeping for rows that only ever grow. Run it daily from a scheduler
 * (cron, Windows Task Scheduler, a platform cron job, ...):
 *
 *   npm run db:cleanup
 *
 * Removes expired sessions, used or expired password-reset tokens, expired
 * sign-in challenges, old failed-login records, and audit entries older than
 * AUDIT_RETENTION_DAYS (default 400). Set AUDIT_RETENTION_DAYS=0 to keep them forever.
 */
import "./load-env.mts";
import pg from "pg";
import { adminDatabaseUrl, pgOptions } from "../lib/db-config";

const client = new pg.Client(pgOptions(adminDatabaseUrl()));
await client.connect();

const run = async (label: string, sql: string, params: unknown[] = []) => {
  const result = await client.query(sql, params);
  console.log(`${label}: ${result.rowCount ?? 0}`);
};

await run("expired sessions", "DELETE FROM sessions WHERE expires_at < now() OR last_seen_at < now() - interval '12 hours'");
await run("old password-reset tokens", "DELETE FROM password_resets WHERE expires_at < now() - interval '1 day' OR used_at IS NOT NULL");
await run("expired sign-in challenges", "DELETE FROM login_challenges WHERE expires_at < now()");
await run("old failed-login records", "DELETE FROM login_attempts WHERE at < now() - interval '1 day'");

const retention = Number(process.env.AUDIT_RETENTION_DAYS ?? 400);
if (retention > 0) {
  await run("old audit entries", "DELETE FROM audit_log WHERE at < now() - $1 * interval '1 day'", [retention]);
}
await client.end();
