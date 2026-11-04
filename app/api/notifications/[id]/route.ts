import { query } from "@/lib/server/db";
import { csrfGuard, failure, requireUser, success } from "@/lib/server/http";

/** Marks one of the signed-in user's own notifications as read. */
export async function POST(_request: Request, ctx: RouteContext<"/api/notifications/[id]">) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const recipient = auth.user.role === "admin" ? "admin" : auth.user.refId;
  const rows = await query("UPDATE notifications SET read = true WHERE id = $1 AND recipient = $2 RETURNING id", [id, recipient]);
  return rows.length ? success({}) : failure("Notification not found.", 404);
}
