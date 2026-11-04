import { z } from "zod";
import { verifyTotpLogin } from "@/lib/server/auth";
import { csrfGuard, failure, readJson, success } from "@/lib/server/http";

const body = z.object({ challenge: z.string().min(20).max(200), code: z.string().min(6).max(24) });

export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure("Enter the 6-digit code from your authenticator app.");
  const result = await verifyTotpLogin(parsed.data.challenge, parsed.data.code);
  return result.ok ? success({ requiresTotp: false, ...result.user }) : failure(result.error, result.status);
}
