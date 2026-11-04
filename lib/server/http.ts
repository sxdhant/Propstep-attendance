import "server-only";
import { getCurrentUser, type AuthUser } from "@/lib/server/auth";
import { isSameOrigin } from "@/lib/server/request";
import type { UserRole } from "@/types/common";

export const failure = (error: string, status = 400, code?: string) =>
  Response.json({ ok: false, error, ...(code ? { code } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
export const success = <T>(data: T, status = 200) =>
  Response.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } });

/** Rejects cross-site state-changing requests. Call first in every POST/PATCH/DELETE handler. */
export async function csrfGuard(): Promise<Response | null> {
  return (await isSameOrigin()) ? null : failure("Cross-site request blocked.", 403);
}

/**
 * Resolves the signed-in user or a ready-made error response. Accounts that
 * still carry a temporary password can only reach the password-change flow.
 */
export async function requireUser(
  role?: UserRole,
  opts: { allowPasswordChangePending?: boolean } = {},
): Promise<{ user: AuthUser } | { response: Response }> {
  const user = await getCurrentUser();
  if (!user) return { response: failure("Please sign in.", 401) };
  if (user.mustChangePassword && !opts.allowPasswordChangePending) {
    return { response: failure("Choose a new password before continuing.", 403, "PASSWORD_CHANGE_REQUIRED") };
  }
  if (role && user.role !== role) return { response: failure("You don't have permission to do that.", 403) };
  return { user };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
