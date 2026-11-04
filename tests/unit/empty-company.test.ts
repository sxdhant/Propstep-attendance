import { describe, expect, it } from "vitest";
import { DB_VERSION, DEFAULT_SETTINGS } from "@/lib/constants";
import { selectAdminOverview, selectApprovalRows, selectPendingCount } from "@/lib/selectors/admin";
import { createAttendanceContext } from "@/lib/selectors/context";
import { selectPayrollRows, summarizePayrollRows } from "@/lib/selectors/payroll";
import { selectReport } from "@/lib/selectors/reports";
import type { Database } from "@/types/database";

/**
 * A brand-new company has an administrator and nothing else. Every admin screen
 * must render for that state, so none of these calculations may throw or produce NaN.
 */
const db: Database = {
  version: DB_VERSION,
  seededAt: "2026-11-04T10:00:00+05:30",
  clockOffsetMs: 0,
  settings: structuredClone(DEFAULT_SETTINGS),
  admins: [{ id: "ADM-001", fullName: "Admin", email: "admin@example.com", title: "Administrator" }],
  employees: [],
  attendance: {},
  payroll: {},
  notifications: [],
  holidays: [],
};
const ctx = createAttendanceContext(db, new Date("2026-11-04T06:00:00Z").getTime());

describe("admin screens with no employees yet", () => {
  it("builds the dashboard overview", () => {
    const overview = selectAdminOverview(db, ctx);
    expect(overview).toBeTruthy();
    expect(JSON.stringify(overview)).not.toMatch(/NaN|Infinity/);
  });

  it("builds approvals and the pending count", () => {
    expect(selectApprovalRows(db, ctx, 2026, 11)).toEqual([]);
    expect(selectPendingCount(db)).toBe(0);
  });

  it("builds payroll rows and totals", () => {
    const rows = selectPayrollRows(db, ctx, 2026, 11);
    expect(rows).toEqual([]);
    expect(JSON.stringify(summarizePayrollRows(rows))).not.toMatch(/NaN|Infinity/);
  });

  it("builds a report", () => {
    const report = selectReport(db, ctx, {
      start: "2026-11-01",
      end: "2026-11-30",
      employeeId: "all",
      department: "all",
      attendanceStatus: "all",
      payrollStatus: "all",
    });
    expect(report.rows).toEqual([]);
    expect(JSON.stringify(report.summary)).not.toMatch(/NaN|Infinity/);
  });
});
