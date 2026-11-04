import { z } from "zod";
import { changePassword } from "@/lib/server/auth";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";

const body = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(1).max(256) });

export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser(undefined, { allowPasswordChangePending: true });
  if ("response" in auth) return auth.response;

  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure("Enter your current and new password.");
  const result = await changePassword(auth.user, parsed.data.currentPassword, parsed.data.newPassword);
  return result.ok ? success({}) : failure(result.error, result.status);
}
