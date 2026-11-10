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

describe("personal week off", () => {
  it("is a day off for that employee only: not an absence, not a scheduled working day", async () => {
    const { buildDayEntry, summarizeMonth } = await import("@/lib/attendance-utils");
    const employee = { id: "E1", joiningDate: "2026-10-01" } as Employee;
    const ctx = { today: "2026-10-31", nowMs: Date.parse("2026-10-31T12:00:00Z"), policy: DEFAULT_SETTINGS.attendance, holidays: {} };
    const off = { id: "E1_2026-10-07", employeeId: "E1", date: "2026-10-07", checkIn: null, checkOut: null, status: "week_off", approval: "not_required", remarks: "Entered by admin" } as never;
    const entry = buildDayEntry(employee, "2026-10-07", off, ctx);
    expect(entry.kind).toBe("weekly_off");
    expect(entry.display).toBe("weekly_off");
    const without = summarizeMonth(employee, {}, 2026, 10, ctx);
    const withOff = summarizeMonth(employee, { "E1_2026-10-07": off } as never, 2026, 10, ctx);
    expect(withOff.scheduledWorkingDays).toBe(without.scheduledWorkingDays - 1);
    expect(withOff.absentDays).toBe(without.absentDays - 1);
  });
});

describe("comp-off", () => {
  const employee = { id: "E1", joiningDate: "2026-10-01" } as Employee;
  const ctx = { today: "2026-10-31", nowMs: Date.parse("2026-10-31T12:00:00Z"), policy: DEFAULT_SETTINGS.attendance, holidays: { "2026-10-20": "Diwali" } };
  const rec = (date: string, status: string, approval = "approved") => ({ id: `E1_${date}`, employeeId: "E1", date, checkIn: null, checkOut: null, status, approval, remarks: "Entered by admin" }) as never;

  it("is earned by approved work on a holiday: a full day earns 1, a half day 0.5, pending earns nothing", async () => {
    const { computeCompOffBalance } = await import("@/lib/comp-off");
    const h = ctx.holidays;
    expect(computeCompOffBalance([rec("2026-10-20", "present")], h)).toEqual({ earned: 1, taken: 0, balance: 1 });
    expect(computeCompOffBalance([rec("2026-10-20", "half_day")], h).earned).toBe(0.5);
    expect(computeCompOffBalance([rec("2026-10-20", "present", "pending")], h).earned).toBe(0);
    expect(computeCompOffBalance([rec("2026-10-14", "present")], h).earned).toBe(0); // not a holiday
    expect(computeCompOffBalance([rec("2026-10-20", "present"), rec("2026-10-22", "comp_off", "not_required")], h)).toEqual({ earned: 1, taken: 1, balance: 0 });
  });

  it("makes a comp-off day a paid day: not absent, not a holiday, still a scheduled working day", async () => {
    const { buildDayEntry, summarizeMonth } = await import("@/lib/attendance-utils");
    const day = buildDayEntry(employee, "2026-10-22", rec("2026-10-22", "comp_off", "not_required"), ctx);
    expect(day).toMatchObject({ kind: "working", display: "comp_off", attendanceStatus: "comp_off", compOff: true });

    const base = summarizeMonth(employee, {}, 2026, 10, ctx);
    const withCompOff = summarizeMonth(employee, { "E1_2026-10-22": rec("2026-10-22", "comp_off", "not_required") } as never, 2026, 10, ctx);
    expect(withCompOff.compOffDays).toBe(1);
    expect(withCompOff.absentDays).toBe(base.absentDays - 1);
    expect(withCompOff.scheduledWorkingDays).toBe(base.scheduledWorkingDays);
    expect(withCompOff.holidayCount).toBe(base.holidayCount);
  });

  it("does not pay holiday work a second time, and pays the comp-off day with no deduction", async () => {
    const { summarizeMonth } = await import("@/lib/attendance-utils");
    const { buildPayrollSnapshot } = await import("@/lib/salary-calculator");
    // Works every other day of October 1-19 and 21-31, works the Diwali holiday, then takes one comp-off day instead of working the 22nd.
    const records: Record<string, unknown> = { "E1_2026-10-20": rec("2026-10-20", "present"), "E1_2026-10-22": rec("2026-10-22", "comp_off", "not_required") };
    for (let d = 1; d <= 31; d++) {
      const date = `2026-10-${String(d).padStart(2, "0")}`;
      if (date === "2026-10-20" || date === "2026-10-22") continue;
      records[`E1_${date}`] = rec(date, "present");
    }
    const summary = summarizeMonth(employee, records as never, 2026, 10, ctx);
    expect(summary.compOffEarned).toBe(1);
    expect(summary.compOffDays).toBe(1);
    expect(summary.absentDays).toBe(0);
    const snapshot = buildPayrollSnapshot(30000, summary, DEFAULT_SETTINGS.salary);
    expect(snapshot.compOffDays).toBe(1);
    // 29 worked days + 1 comp-off day = 30 payable units over 30 scheduled days (31 minus the holiday): full salary.
    expect(snapshot.payableUnits).toBe(30);
    expect(snapshot.estimatedSalary).toBe(30000);
  });
});
