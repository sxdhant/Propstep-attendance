import { z } from "zod";
import { listSessions, revokeSession } from "@/lib/server/auth";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { toIstTimestamp } from "@/lib/date-utils";

/** The signed-in user's active devices. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const rows = await listSessions(auth.user);
  return success(
    rows.map((s) => ({
      id: s.id,
      current: s.id === auth.user.sessionId,
      createdAt: toIstTimestamp(s.created_at),
      lastSeenAt: toIstTimestamp(s.last_seen_at),
      ip: s.ip,
      userAgent: s.user_agent,
    })),
  );
}

/** Sign out a specific device. */
export async function DELETE(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await readJson(request));
  if (!parsed.success) return failure("Provide the session id.");
  return (await revokeSession(auth.user, parsed.data.id)) ? success({}) : failure("Session not found.", 404);
}
