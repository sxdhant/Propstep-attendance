import { beginTotpSetup } from "@/lib/server/auth";
import { csrfGuard, requireUser, success } from "@/lib/server/http";

/** Returns a fresh secret and otpauth:// URI to show as a QR code. Inactive until confirmed. */
export async function POST() {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return success(await beginTotpSetup(auth.user));
}
