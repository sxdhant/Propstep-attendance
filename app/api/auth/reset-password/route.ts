import { z } from "zod";
import { resetPassword } from "@/lib/server/auth";
import { csrfGuard, failure, readJson, success } from "@/lib/server/http";

const body = z.object({ token: z.string().min(20).max(200), newPassword: z.string().min(1).max(256) });

export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure("This reset link is invalid or has expired.");
  const result = await resetPassword(parsed.data.token, parsed.data.newPassword);
  return result.ok ? success({}) : failure(result.error, result.status);
}
