import type { MonthlyAttendanceSummary } from "@/lib/attendance-utils";
import type { DivisorPolicy, PayrollSnapshot, SalaryCalculation } from "@/types/payroll";
import type { SalaryPolicy } from "@/types/settings";

/**
 * Demonstration salary formula. This is the single place the calculation
 * lives, so the backend phase can replace it (or call a server endpoint)
 * without touching any component.
 *
 *   Payable Attendance Units = Approved Full Days + (Approved Half Days × half-day value)
 *   Estimated Salary         = Monthly Basic Salary × Payable Units ÷ Salary Divisor
 *
 * Example: ₹30,000 × 22.5 ÷ 25 = ₹27,000 (22 full days, 1 half day, 25 scheduled days).
 */

export const DIVISOR_POLICY_LABELS: Record<DivisorPolicy, string> = {
  scheduled_working_days: "Scheduled working days",
  calendar_days: "Calendar days in the month",
  fixed: "Fixed divisor",
};

export interface SalaryInput {
  monthlyBasicSalary: number;
  approvedFullDays: number;
  approvedHalfDays: number;
  scheduledWorkingDays: number;
  calendarDays: number;
}

export function getSalaryDivisor(
  policy: SalaryPolicy,
  month: Pick<SalaryInput, "scheduledWorkingDays" | "calendarDays">,
): number {
  const divisor =
    policy.divisorPolicy === "calendar_days"
      ? month.calendarDays
      : policy.divisorPolicy === "fixed"
        ? policy.fixedDivisor
        : month.scheduledWorkingDays;
  // Guards against a division by zero in a month with no scheduled days.
  return Math.max(1, divisor);
}

export function calculatePayableUnits(fullDays: number, halfDays: number, halfDayUnits: number): number {
  return Math.round((fullDays + halfDays * halfDayUnits) * 100) / 100;
}

export function calculateSalary(input: SalaryInput, policy: SalaryPolicy): SalaryCalculation {
  const divisor = getSalaryDivisor(policy, input);
  const payableUnits = calculatePayableUnits(
    input.approvedFullDays,
    input.approvedHalfDays,
    policy.halfDayUnits,
  );
  const raw = (input.monthlyBasicSalary * payableUnits) / divisor;
  const cappedAtBasic = raw > input.monthlyBasicSalary;

  return {
    monthlyBasicSalary: input.monthlyBasicSalary,
    scheduledWorkingDays: input.scheduledWorkingDays,
    calendarDays: input.calendarDays,
    divisorPolicy: policy.divisorPolicy,
    divisor,
    approvedFullDays: input.approvedFullDays,
    approvedHalfDays: input.approvedHalfDays,
    halfDayUnits: policy.halfDayUnits,
    payableUnits,
    perDayRate: input.monthlyBasicSalary / divisor,
    estimatedSalary: Math.round(Math.min(raw, input.monthlyBasicSalary)),
    cappedAtBasic,
  };
}

/** Combines an attendance summary with the salary formula into the figures payroll shows. */
export function buildPayrollSnapshot(
  monthlyBasicSalary: number,
  summary: MonthlyAttendanceSummary,
  policy: SalaryPolicy,
): PayrollSnapshot {
  const calculation = calculateSalary(
    {
      monthlyBasicSalary,
      approvedFullDays: summary.approvedFullDays,
      approvedHalfDays: summary.approvedHalfDays,
      scheduledWorkingDays: summary.scheduledWorkingDays,
      calendarDays: summary.calendarDays,
    },
    policy,
  );

  return {
    ...calculation,
    pendingDays: summary.pendingDays,
    rejectedDays: summary.rejectedDays,
    incompleteDays: summary.incompleteDays,
    absentDays: summary.absentDays,
    unpaidDays: summary.unpaidDays,
  };
}

/** The worked example from the product brief, kept as data so the UI can show it verbatim. */
export const SALARY_EXAMPLE: SalaryInput = {
  monthlyBasicSalary: 30_000,
  approvedFullDays: 22,
  approvedHalfDays: 1,
  scheduledWorkingDays: 25,
  calendarDays: 31,
};
