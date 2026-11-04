import { toIstTimestamp } from "@/lib/date-utils";
import { query } from "@/lib/server/db";
import { requireUser, success } from "@/lib/server/http";

/** GET /api/audit?limit=100&action=login  - the security trail, newest first. Admin only. */
export async function GET(request: Request) {
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const limit = Math.min(500, Math.max(1, Number(params.get("limit")) || 100));
  const prefix = params.get("action");

  const rows = await query<{ id: string; at: Date; action: string; target: string | null; ip: string | null; email: string | null }>(
    `SELECT a.id, a.at, a.action, a.target, a.ip, u.email
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE ($1::text IS NULL OR a.action LIKE $1 || '%')
      ORDER BY a.at DESC, a.id DESC LIMIT $2`,
    [prefix, limit],
  );
  return success(rows.map((r) => ({ id: r.id, at: toIstTimestamp(r.at), action: r.action, target: r.target, ip: r.ip, actor: r.email })));
}
