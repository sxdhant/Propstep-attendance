import { daysInMonth, makeDateKey, monthEnd, monthStart, shiftMonth } from "@/lib/date-utils";
import type { DateKey } from "@/types/common";
import type { Employee } from "@/types/employee";
import type { PayrollRecord } from "@/types/payroll";

export const payrollId = (employeeId: string, year: number, month: number) =>
  `${employeeId}_${year}-${String(month).padStart(2, "0")}`;

/** Finalized and paid payroll is frozen: its figures and the month's attendance can no longer change. */
export function isPayrollLocked(record: PayrollRecord | null | undefined): boolean {
  return record?.status === "finalized" || record?.status === "paid";
}

/** Whether an employee belongs in the payroll run for a month. */
export function isEmployeeInPayrollMonth(employee: Employee, year: number, month: number): boolean {
  if (employee.joiningDate > monthEnd(year, month)) return false;
  if (employee.deactivatedOn && employee.deactivatedOn < monthStart(year, month)) return false;
  return true;
}

/** Salaries for a month are paid on `payDay` of the following month. */
export function payDateFor(year: number, month: number, payDay: number): DateKey {
  const next = shiftMonth({ year, month }, 1);
  return makeDateKey(next.year, next.month, Math.min(payDay, daysInMonth(next.year, next.month)));
}
