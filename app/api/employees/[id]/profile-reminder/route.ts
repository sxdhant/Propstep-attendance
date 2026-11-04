import { csrfGuard, failure, requireUser, success } from "@/lib/server/http";
import { getPool } from "@/lib/server/db";
import { addNotification, findEmployee } from "@/lib/server/repo";

/** Lets an admin nudge someone who has not finished their profile. */
export async function POST(_request: Request, ctx: RouteContext<"/api/employees/[id]/profile-reminder">) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const employee = await findEmployee(id);
  if (!employee) return failure("Employee not found.", 404);
  if (employee.profile?.state === "submitted") return failure("This profile is already complete.", 409);
  await addNotification(getPool(), {
    recipient: id,
    type: "policy_update",
    title: "Please complete your profile",
    message: "Your administrator is waiting for your personal, education, work and bank details.",
    href: "/employee/profile",
  });
  return success({});
}
