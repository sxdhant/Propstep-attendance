import { z } from "zod";
import { signIn } from "@/lib/server/auth";
import { csrfGuard, failure, readJson, success } from "@/lib/server/http";

const body = z.object({ email: z.string().max(254), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure("Enter your email and password.");

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return failure(result.error, result.status);
  if (result.requiresTotp) return success({ requiresTotp: true, challenge: result.challenge });
  return success({ requiresTotp: false, ...result.user });
}
