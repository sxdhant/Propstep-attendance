import { audit } from "@/lib/server/audit";
import { avatarUrl, MAX_AVATAR_BYTES, sniffImageType } from "@/lib/server/avatars";
import { query, queryOne } from "@/lib/server/db";
import { csrfGuard, failure, requireUser, success } from "@/lib/server/http";

/** The signed-in person replaces their own profile photo. The body is the raw image (the browser resizes it first). */
export async function PUT(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_AVATAR_BYTES) return failure("That photo is too large. Choose one under 400 KB.", 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return failure("Choose a photo to upload.", 422);
  if (bytes.length > MAX_AVATAR_BYTES) return failure("That photo is too large. Choose one under 400 KB.", 413);
  const type = sniffImageType(bytes);
  if (!type) return failure("Use a JPEG, PNG or WebP photo.", 415);

  const row = await queryOne<{ v: string }>(
    `INSERT INTO avatars (owner_id, content_type, data, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (owner_id) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = now()
     RETURNING (extract(epoch from updated_at) * 1000)::bigint::text AS v`,
    [auth.user.refId, type, Buffer.from(bytes)],
  );
  await audit("profile.photo_updated", { actorUserId: auth.user.userId, target: auth.user.refId });
  return success({ photoUrl: avatarUrl(auth.user.refId, row?.v ?? Date.now()) });
}

export async function DELETE() {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  await query("DELETE FROM avatars WHERE owner_id = $1", [auth.user.refId]);
  await audit("profile.photo_removed", { actorUserId: auth.user.userId, target: auth.user.refId });
  return success({});
}
