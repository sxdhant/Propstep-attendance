import { randomBytes } from "node:crypto";
import { audit } from "@/lib/server/audit";
import { query, queryOne, transaction } from "@/lib/server/db";
import { csrfGuard, failure, requireUser, success } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/passwords";

/**
 * Admin-initiated reset for an employee who can't use the email flow. Issues a
 * new one-time temporary password, signs the employee out everywhere and
 * forces them to choose their own password at next sign-in.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/employees/[id]/reset-password">) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const temporaryPassword = `${randomBytes(12).toString("base64url")}!1a`;
  const passwordHash = await hashPassword(temporaryPassword);

  const result = await transaction(async (tx) => {
    const user = await queryOne<{ id: string }>("SELECT id FROM users WHERE role='employee' AND ref_id = $1 FOR UPDATE", [id], tx);
    if (!user) return failure("Employee not found.", 404);
    await query("UPDATE users SET password_hash = $1, must_change_password = true, password_changed_at = now() WHERE id = $2", [passwordHash, user.id], tx);
    await query("DELETE FROM sessions WHERE user_id = $1", [user.id], tx);
    await query("DELETE FROM password_resets WHERE user_id = $1", [user.id], tx);
    return success({ temporaryPassword });
  });

  if (result.ok) await audit("password.admin_reset", { actorUserId: auth.user.userId, target: id });
  return result;
}
