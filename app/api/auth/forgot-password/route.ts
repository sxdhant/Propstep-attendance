import { z } from "zod";
import { requestPasswordReset } from "@/lib/server/auth";
import { csrfGuard, failure, readJson, success } from "@/lib/server/http";

const body = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure("Enter a valid email address.");

  try {
    await requestPasswordReset(parsed.data.email);
  } catch (error) {
    console.error("password reset request failed", error instanceof Error ? error.message : error);
  }
  // Identical answer whether or not the account exists.
  return success({ message: "If an account exists for that email, a reset link is on its way." }, 202);
}
