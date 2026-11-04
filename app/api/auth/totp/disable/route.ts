import { z } from "zod";
import { disableTotp } from "@/lib/server/auth";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";

export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = z.object({ password: z.string().min(1).max(256), code: z.string().min(6).max(10) }).safeParse(await readJson(request));
  if (!parsed.success) return failure("Enter your password and a current code.");
  const result = await disableTotp(auth.user, parsed.data.password, parsed.data.code);
  return result.ok ? success({}) : failure(result.error, result.status);
}
