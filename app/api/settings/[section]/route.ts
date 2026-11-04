import { audit } from "@/lib/server/audit";
import { query, transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { addNotification, loadSettings } from "@/lib/server/repo";
import { attendancePolicySchema, companySettingsSchema, salaryPolicySchema } from "@/lib/validation/schemas";

const SCHEMAS = {
  company: companySettingsSchema,
  attendance: attendancePolicySchema,
  salary: salaryPolicySchema,
} as const;

/** Replaces one settings section (company | attendance | salary). Admin only. */
export async function PUT(request: Request, ctx: RouteContext<"/api/settings/[section]">) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const { section } = await ctx.params;
  if (!(section in SCHEMAS)) return failure("Unknown settings section.", 404);
  const key = section as keyof typeof SCHEMAS;

  const parsed = SCHEMAS[key].safeParse(await readJson(request));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid settings.", 422);

  const result = await transaction(async (tx) => {
    const current = await loadSettings(tx);
    const next = { ...current, [key]: parsed.data };
    await query("UPDATE settings SET value = $1 WHERE key = 'app'", [JSON.stringify(next)], tx);

    // Employees are told when the rules that decide their attendance change.
    if (key === "attendance") {
      const policy = parsed.data as typeof next.attendance;
      const active = await query<{ id: string }>("SELECT id FROM employees WHERE status = 'active'", [], tx);
      for (const e of active) {
        await addNotification(tx, {
          recipient: e.id,
          type: "policy_update",
          title: "Attendance policy updated",
          message: `Office hours are now ${policy.officeStartTime} to ${policy.officeEndTime} with ${policy.requiredWorkingHours} required hours.`,
          href: "/employee/attendance",
        });
      }
    }
    return next;
  });

  await audit(`settings.${key}_updated`, { actorUserId: auth.user.userId, meta: { values: parsed.data as Record<string, unknown> } });
  return success(result);
}
