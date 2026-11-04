import { requireUser, success } from "@/lib/server/http";

export async function GET() {
  const auth = await requireUser(undefined, { allowPasswordChangePending: true });
  if ("response" in auth) return auth.response;
  const { role, refId, email, mustChangePassword, totpEnabled } = auth.user;
  return success({ role, refId, email, mustChangePassword, totpEnabled });
}
