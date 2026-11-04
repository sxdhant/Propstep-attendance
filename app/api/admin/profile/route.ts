import { audit } from "@/lib/server/audit";
import { queryOne } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { adminProfileSchema } from "@/lib/validation/schemas";

/** The signed-in administrator updates their own name, job title and phone. Email is changed separately. */
export async function PATCH(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const parsed = adminProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid profile details.", 422);
  const { fullName, title, phone } = parsed.data;

  const row = await queryOne<{ id: string; full_name: string; email: string; title: string; phone: string }>(
    "UPDATE admins SET full_name = $1, title = $2, phone = $3 WHERE id = $4 RETURNING id, full_name, email, title, phone",
    [fullName, title, phone, auth.user.refId],
  );
  if (!row) return failure("Administrator not found.", 404);

  await audit("admin.profile_updated", { actorUserId: auth.user.userId, target: row.id });
  return success({ id: row.id, fullName: row.full_name, email: row.email, title: row.title, phone: row.phone });
}
