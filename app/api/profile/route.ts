import { toDateKey, toIstTimestamp } from "@/lib/date-utils";
import { normalizeProfile } from "@/lib/profile-normalize";
import { audit } from "@/lib/server/audit";
import { query, transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { addNotification, findEmployee } from "@/lib/server/repo";
import { createProfileSchemas } from "@/lib/validation/profile-schemas";
import type { EmployeeProfile, ProfileContent } from "@/types/profile";

/** Content is `{ personal, education, experience, bank, ... }`; the schema below is the source of truth. */
async function saveProfile(mode: "draft" | "submit", request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("employee");
  if ("response" in auth) return auth.response;

  const body = (await readJson(request)) as { content?: ProfileContent } | null;
  if (!body?.content || typeof body.content !== "object") return failure("Send the profile in a `content` field.");
  // Reject oversized payloads and shapes that can't be normalized instead of failing with a 500.
  if (JSON.stringify(body.content).length > 100_000) return failure("That profile is too large.", 413);
  let tidy: ProfileContent;
  try {
    tidy = normalizeProfile(body.content);
  } catch {
    return failure("Some details are missing or invalid. Go back and fix the highlighted fields.", 422);
  }

  const result = await transaction(async (tx) => {
    const employee = await findEmployee(auth.user.refId, tx, true);
    if (!employee) return failure("Employee not found.", 404);
    const now = new Date();
    const stamp = toIstTimestamp(now);

    let profile: EmployeeProfile;
    if (mode === "draft") {
      if (employee.profile?.state === "submitted") {
        return failure("This profile is already submitted. Save your changes with Update profile.", 409);
      }
      profile = { state: "draft", updatedAt: stamp, ...tidy };
    } else {
      const check = createProfileSchemas(toDateKey(now)).full.safeParse(tidy);
      if (!check.success) return failure("Some details are missing or invalid. Go back and fix the highlighted fields.", 422);
      profile = { state: "submitted", updatedAt: stamp, submittedAt: employee.profile?.submittedAt ?? stamp, ...tidy };
      const firstTime = employee.profile?.state !== "submitted";
      await addNotification(tx, {
        recipient: "admin",
        type: "policy_update",
        title: firstTime ? "Profile submitted" : "Profile updated",
        message: `${employee.fullName} (${employee.id}) ${firstTime ? "completed their profile." : "updated their profile."}`,
        href: "/admin/employees",
      });
    }
    await query("UPDATE employees SET profile = $1 WHERE id = $2", [JSON.stringify(profile), employee.id], tx);
    return success({ ...employee, profile });
  });

  if (result.ok && mode === "submit") await audit("profile.submitted", { actorUserId: auth.user.userId, target: auth.user.refId });
  return result;
}

/** PUT = save a draft (no validation); POST = validate everything and submit. */
export const PUT = (request: Request) => saveProfile("draft", request);
export const POST = (request: Request) => saveProfile("submit", request);
