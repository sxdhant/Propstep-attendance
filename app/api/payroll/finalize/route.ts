import { z } from "zod";
import { toIstTimestamp } from "@/lib/date-utils";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { payrollId } from "@/lib/payroll-utils";
import { audit } from "@/lib/server/audit";
import { transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { buildRow, loadMonthData, lockPayroll, savePayroll } from "@/lib/server/payroll";
import { addNotification } from "@/lib/server/repo";
import type { PayrollRecord } from "@/types/payroll";

const body = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  /** Omit to finalize every draft line in the month. */
  employeeId: z.string().max(40).optional(),
});

/**
 * Freezes draft payroll: the salary figures are snapshotted and the month's
 * attendance can no longer change. The payroll rows are locked first, so a
 * simultaneous attendance approval either lands before the snapshot or is refused.
 */
export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure("Provide a valid year and month.");
  const { year, month, employeeId } = parsed.data;

  const result = await transaction(async (tx) => {
    await lockPayroll(tx, year, month, employeeId);
    const data = await loadMonthData(tx, year, month, employeeId);
    const label = formatMonthYear(year, month);

    if (employeeId && !data.records[payrollId(employeeId, year, month)]) {
      return failure("Generate payroll for this month before finalizing it.", 409);
    }

    let count = 0;
    let total = 0;
    const finalized: PayrollRecord[] = [];
    for (const employee of data.employees) {
      const record = data.records[payrollId(employee.id, year, month)];
      if (!record) continue;
      if (record.status !== "draft") {
        if (employeeId) return failure(`This payroll is already ${record.status}.`, 409);
        continue;
      }
      const row = buildRow(data, employee, year, month); // live figures from locked, committed attendance
      const next: PayrollRecord = {
        ...record,
        status: "finalized",
        finalizedAt: toIstTimestamp(new Date()),
        finalizedBy: auth.user.refId,
        snapshot: row.figures,
      };
      await savePayroll(tx, next);
      await addNotification(tx, {
        recipient: employee.id,
        type: "payroll_finalized",
        title: `${label} payroll finalized`,
        message: `Your salary for ${label} was finalized at ${formatCurrency(row.figures.estimatedSalary)}.`,
        href: "/employee/salary",
      });
      finalized.push(next);
      count += 1;
      total += row.figures.estimatedSalary;
    }
    if (count === 0) return failure("There are no draft payroll lines to finalize.", 409);
    return success({ count, total, records: finalized });
  });

  if (result.ok) await audit("payroll.finalized", { actorUserId: auth.user.userId, target: employeeId ?? `${year}-${month}` });
  return result;
}
