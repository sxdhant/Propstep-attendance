import { summarizeMonth, type AttendanceContext } from "@/lib/attendance-utils";
import { isEmployeeInPayrollMonth, isPayrollLocked, payrollId } from "@/lib/payroll-utils";
import { buildPayrollSnapshot } from "@/lib/salary-calculator";
import type { Database } from "@/types/database";
import type { Employee } from "@/types/employee";
import type { PayrollRow } from "@/types/payroll";

/**
 * One payroll line. Finalized and paid lines show their frozen snapshot;
 * everything else is recalculated from current attendance, so approving a
 * day immediately moves the estimate.
 */
export function buildPayrollRow(
  db: Database,
  ctx: AttendanceContext,
  employee: Employee,
  year: number,
  month: number,
): PayrollRow {
  const record = db.payroll[payrollId(employee.id, year, month)] ?? null;

  if (record && isPayrollLocked(record) && record.snapshot) {
    return { employee, year, month, status: record.status, record, figures: record.snapshot, isLive: false };
  }

  const summary = summarizeMonth(employee, db.attendance, year, month, ctx);
  return {
    employee,
    year,
    month,
    status: record ? record.status : "not_generated",
    record,
    figures: buildPayrollSnapshot(employee.monthlyBasicSalary, summary, db.settings.salary),
    isLive: true,
  };
}

export function selectPayrollRows(
  db: Database,
  ctx: AttendanceContext,
  year: number,
  month: number,
): PayrollRow[] {
  return db.employees
    .filter((employee) => isEmployeeInPayrollMonth(employee, year, month))
    .map((employee) => buildPayrollRow(db, ctx, employee, year, month));
}

export interface PayrollTotals {
  employees: number;
  /** Sum of every line's salary, live or frozen. */
  estimated: number;
  /** Finalized plus paid. */
  finalized: number;
  paid: number;
  /** Finalized but not yet paid. */
  unpaid: number;
  unpaidCount: number;
  notGeneratedCount: number;
  draftCount: number;
  finalizedCount: number;
  paidCount: number;
  /** Total of every employee's full basic salary, i.e. payroll at perfect attendance. */
  basicTotal: number;
}

export function summarizePayrollRows(rows: PayrollRow[]): PayrollTotals {
  const totals: PayrollTotals = {
    employees: rows.length,
    estimated: 0,
    finalized: 0,
    paid: 0,
    unpaid: 0,
    unpaidCount: 0,
    notGeneratedCount: 0,
    draftCount: 0,
    finalizedCount: 0,
    paidCount: 0,
    basicTotal: 0,
  };

  for (const row of rows) {
    const amount = row.figures.estimatedSalary;
    totals.estimated += amount;
    totals.basicTotal += row.employee.monthlyBasicSalary;
    switch (row.status) {
      case "not_generated":
        totals.notGeneratedCount += 1;
        break;
      case "draft":
        totals.draftCount += 1;
        break;
      case "finalized":
        totals.finalizedCount += 1;
        totals.finalized += amount;
        totals.unpaid += amount;
        totals.unpaidCount += 1;
        break;
      case "paid":
        totals.paidCount += 1;
        totals.finalized += amount;
        totals.paid += amount;
        break;
    }
  }
  return totals;
}
