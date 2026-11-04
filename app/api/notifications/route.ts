import { query } from "@/lib/server/db";
import { csrfGuard, requireUser, success } from "@/lib/server/http";
import { toNotification } from "@/lib/server/repo";

const recipientFor = (role: string, refId: string) => (role === "admin" ? "admin" : refId);

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const rows = await query(
    "SELECT * FROM notifications WHERE recipient = $1 ORDER BY created_at DESC LIMIT 100",
    [recipientFor(auth.user.role, auth.user.refId)],
  );
  return success(rows.map((row) => toNotification(row as never)));
}

/** Marks all of the signed-in user's notifications as read. */
export async function POST() {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  await query("UPDATE notifications SET read = true WHERE recipient = $1", [recipientFor(auth.user.role, auth.user.refId)]);
  return success({});
}
