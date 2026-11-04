import { z } from "zod";
import { enableTotp } from "@/lib/server/auth";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";

export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const parsed = z.object({ code: z.string().min(6).max(10) }).safeParse(await readJson(request));
  if (!parsed.success) return failure("Enter the 6-digit code.");
  const result = await enableTotp(auth.user, parsed.data.code);
  return result.ok ? success({ recoveryCodes: result.recoveryCodes }) : failure(result.error, result.status);
}
