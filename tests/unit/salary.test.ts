import { describe, expect, it } from "vitest";
import { getDayKind, deriveStatusFromWorkedMinutes } from "@/lib/attendance-utils";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { isEmployeeInPayrollMonth, isPayrollLocked, payrollId } from "@/lib/payroll-utils";
import { calculateSalary, SALARY_EXAMPLE } from "@/lib/salary-calculator";
import type { Employee } from "@/types/employee";

const policy = DEFAULT_SETTINGS.salary;

describe("salary calculation", () => {
  it("matches the worked example: 30,000 x 22.5 / 25 = 27,000", () => {
    const result = calculateSalary(SALARY_EXAMPLE, policy);
    expect(result.payableUnits).toBe(22.5);
    expect(result.estimatedSalary).toBe(27_000);
    expect(result.cappedAtBasic).toBe(false);
  });

  it("never pays more than the basic salary", () => {
    const result = calculateSalary({ ...SALARY_EXAMPLE, approvedFullDays: 40 }, policy);
    expect(result.estimatedSalary).toBe(SALARY_EXAMPLE.monthlyBasicSalary);
    expect(result.cappedAtBasic).toBe(true);
  });

  it("survives a month with no scheduled days (no division by zero)", () => {
    const result = calculateSalary({ ...SALARY_EXAMPLE, scheduledWorkingDays: 0, approvedFullDays: 0, approvedHalfDays: 0 }, policy);
    expect(Number.isFinite(result.estimatedSalary)).toBe(true);
    expect(result.divisor).toBe(1);
  });

  it("honours the divisor policy", () => {
    expect(calculateSalary(SALARY_EXAMPLE, { ...policy, divisorPolicy: "calendar_days" }).divisor).toBe(31);
    expect(calculateSalary(SALARY_EXAMPLE, { ...policy, divisorPolicy: "fixed", fixedDivisor: 26 }).divisor).toBe(26);
  });
});

describe("attendance rules", () => {
  const ctx = { policy: { ...DEFAULT_SETTINGS.attendance, weeklyOffs: [2] }, holidays: { "2026-11-11": "Test Holiday" } };

  it("treats Tuesday as the weekly off and Sunday as a working day", () => {
    expect(getDayKind("2026-11-03", ctx).kind).toBe("weekly_off"); // Tuesday
    expect(getDayKind("2026-11-01", ctx).kind).toBe("working"); // Sunday
  });

  it("lets a holiday beat a working day", () => {
    expect(getDayKind("2026-11-11", ctx)).toEqual({ kind: "holiday", holidayName: "Test Holiday" });
  });

  it("derives status from minutes worked", () => {
    const p = { ...DEFAULT_SETTINGS.attendance, weeklyOffs: [2] };
    expect(deriveStatusFromWorkedMinutes(p.requiredWorkingHours * 60, p)).toBe("present");
    expect(deriveStatusFromWorkedMinutes(p.halfDayThresholdHours * 60, p)).toBe("half_day");
    expect(deriveStatusFromWorkedMinutes(30, p)).toBe("incomplete");
  });
});

describe("payroll rules", () => {
  it("builds deterministic ids and locks finalized / paid months", () => {
    expect(payrollId("EMP-1001", 2026, 9)).toBe("EMP-1001_2026-09");
    expect(isPayrollLocked(undefined)).toBe(false);
    expect(isPayrollLocked({ status: "draft" } as never)).toBe(false);
    expect(isPayrollLocked({ status: "finalized" } as never)).toBe(true);
    expect(isPayrollLocked({ status: "paid" } as never)).toBe(true);
  });

  it("excludes employees who joined after, or left before, the month", () => {
    const base = { joiningDate: "2026-06-01" } as Employee;
    expect(isEmployeeInPayrollMonth(base, 2026, 5)).toBe(false);
    expect(isEmployeeInPayrollMonth(base, 2026, 6)).toBe(true);
    expect(isEmployeeInPayrollMonth({ ...base, deactivatedOn: "2026-07-10" }, 2026, 8)).toBe(false);
  });
});

describe("default calendar", () => {
  it("makes every day a working day until the admin adds a holiday", () => {
    const ctx = { policy: DEFAULT_SETTINGS.attendance, holidays: { "2026-11-11": "Day off" } };
    expect(DEFAULT_SETTINGS.attendance.weeklyOffs).toEqual([]);
    expect(getDayKind("2026-11-10", ctx).kind).toBe("working"); // a Tuesday
    expect(getDayKind("2026-11-15", ctx).kind).toBe("working"); // a Sunday
    expect(getDayKind("2026-11-11", ctx).kind).toBe("holiday");
  });
});
