import { queryOne } from "@/lib/server/db";
import { failure, requireUser } from "@/lib/server/http";

/** Serves a profile photo. Administrators may see anyone's; everyone else only their own. */
export async function GET(_request: Request, ctx: RouteContext<"/api/avatars/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (auth.user.role !== "admin" && auth.user.refId !== id) return failure("Photo not found.", 404);

  const row = await queryOne<{ content_type: string; data: Buffer }>("SELECT content_type, data FROM avatars WHERE owner_id = $1", [id]);
  if (!row) return failure("Photo not found.", 404);
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.content_type,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // The URL carries a version, so a changed photo is a new URL; "private" keeps shared caches out of it.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
