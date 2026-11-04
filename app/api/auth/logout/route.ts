import { signOut } from "@/lib/server/auth";
import { csrfGuard, success } from "@/lib/server/http";

export async function POST() {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  await signOut();
  return success({});
}
