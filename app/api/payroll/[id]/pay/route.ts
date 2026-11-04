import { z } from "zod";
import { toIstTimestamp } from "@/lib/date-utils";
import { formatMonthYear } from "@/lib/format";
import { audit } from "@/lib/server/audit";
import { queryOne, transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { savePayroll } from "@/lib/server/payroll";
import { addNotification } from "@/lib/server/repo";
import type { PayrollRecord } from "@/types/payroll";

const body = z.object({
  reference: z
    .string()
    .trim()
    .min(4, "Enter the payment reference, at least 4 characters.")
    .max(40, "Keep the reference under 40 characters.")
    .regex(/^[A-Za-z0-9/_-]+$/, "Use letters, numbers, hyphens, underscores or slashes only."),
});

/** Records that a finalized salary was paid. Nothing here moves money; it stores the reference the admin typed. */
export async function POST(request: Request, ctx: RouteContext<"/api/payroll/[id]/pay">) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid payment reference.");
  const { id } = await ctx.params;

  const result = await transaction(async (tx) => {
    const row = await queryOne<{ data: PayrollRecord }>("SELECT data FROM payroll WHERE id = $1 FOR UPDATE", [id], tx);
    if (!row) return failure("Payroll record not found.", 404);
    const record = row.data;
    if (record.status === "paid") return failure("This salary is already marked as paid.", 409);
    if (record.status !== "finalized") return failure("Finalize the payroll before marking it as paid.", 409);

    const paid: PayrollRecord = { ...record, status: "paid", paidAt: toIstTimestamp(new Date()), paymentReference: parsed.data.reference };
    await savePayroll(tx, paid);
    await addNotification(tx, {
      recipient: record.employeeId,
      type: "payroll_paid",
      title: `${formatMonthYear(record.year, record.month)} salary marked as paid`,
      message: `Payment reference ${parsed.data.reference}.`,
      href: "/employee/salary",
    });
    return success(paid);
  });

  if (result.ok) await audit("payroll.paid", { actorUserId: auth.user.userId, target: id });
  return result;
}
