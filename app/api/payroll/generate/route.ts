import { z } from "zod";
import { compareMonths, monthOf, toDateKey, toIstTimestamp } from "@/lib/date-utils";
import { isPayrollLocked, payrollId } from "@/lib/payroll-utils";
import { audit } from "@/lib/server/audit";
import { transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { loadMonthData, lockPayroll, savePayroll } from "@/lib/server/payroll";
import type { PayrollRecord } from "@/types/payroll";

const body = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) });

/** Creates a draft for every employee in the month and refreshes existing drafts. */
export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure("Provide a valid year and month.");
  const { year, month } = parsed.data;

  const now = new Date();
  if (compareMonths({ year, month }, monthOf(toDateKey(now))) > 0) {
    return failure("Payroll can only be generated for the current month or a past month.", 409);
  }

  const result = await transaction(async (tx) => {
    await lockPayroll(tx, year, month);
    const data = await loadMonthData(tx, year, month);
    if (data.employees.length === 0) return failure("No employees are on the payroll for this month.", 409);

    const summary = { created: 0, refreshed: 0, locked: 0 };
    const stamp = toIstTimestamp(now);
    for (const employee of data.employees) {
      const id = payrollId(employee.id, year, month);
      const existing = data.records[id];
      if (existing && isPayrollLocked(existing)) {
        summary.locked += 1;
        continue;
      }
      const record: PayrollRecord = existing
        ? { ...existing, generatedAt: stamp }
        : { id, employeeId: employee.id, year, month, status: "draft", generatedAt: stamp };
      await savePayroll(tx, record);
      if (existing) summary.refreshed += 1;
      else summary.created += 1;
    }
    return success(summary);
  });

  if (result.ok) await audit("payroll.generated", { actorUserId: auth.user.userId, target: `${year}-${month}` });
  return result;
}
