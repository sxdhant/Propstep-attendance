import "server-only";
import { query, type Queryable } from "@/lib/server/db";
import { getRequestInfo } from "@/lib/server/request";

/** Append-only security trail: who did what, from where. Never throws into the caller. */
export async function audit(
  action: string,
  opts: { actorUserId?: string | null; target?: string; meta?: Record<string, unknown> } = {},
  db?: Queryable,
) {
  try {
    const { ip } = await getRequestInfo();
    await query(
      "INSERT INTO audit_log (actor_user_id, action, target, ip, meta) VALUES ($1,$2,$3,$4,$5)",
      [opts.actorUserId ?? null, action, opts.target ?? null, ip, JSON.stringify(opts.meta ?? {})],
      db,
    );
  } catch (error) {
    console.error("audit write failed", error instanceof Error ? error.message : error);
  }
}
