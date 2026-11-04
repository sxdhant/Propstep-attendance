import { describe, expect, it } from "vitest";
import { attendanceId } from "@/lib/attendance-utils";
import { DB_VERSION, DEFAULT_SETTINGS } from "@/lib/constants";
import { selectAdminOverview, selectTodayRoster } from "@/lib/selectors/admin";
import { createAttendanceContext } from "@/lib/selectors/context";
import type { Database } from "@/types/database";
import type { Employee } from "@/types/employee";

// 2026-11-04 is a Wednesday (a working day; Tuesday is the weekly off).
const person = (id: string, name: string, over: Partial<Employee> = {}): Employee => ({
  id, fullName: name, email: `${id}@x.example`, phone: "+91 90000 00000", department: "Engineering",
  designation: "Dev", joiningDate: "2025-01-01", monthlyBasicSalary: 30000, status: "active", ...over,
});

const make = (attendance: Database["attendance"], employees: Employee[]): Database => ({
  version: DB_VERSION, seededAt: "2026-11-04T10:00:00+05:30", clockOffsetMs: 0,
  settings: structuredClone(DEFAULT_SETTINGS),
  admins: [{ id: "ADM-001", fullName: "Admin", email: "a@x.example", title: "Admin" }],
  employees, attendance, payroll: {}, notifications: [], holidays: [],
});

const at = (iso: string) => createAttendanceContext(make({}, []), new Date(iso).getTime());
const rec = (employeeId: string, checkIn: string | null, approval: "pending" | "approved" | "rejected" = "pending") => ({
  id: attendanceId(employeeId, "2026-11-04"), employeeId, date: "2026-11-04", checkIn, checkOut: null,
  status: "in_progress" as const, approval,
});

const employees = [
  person("EMP-1", "Zara Present"), person("EMP-2", "Adam Early"), person("EMP-3", "Mia Missing"),
  person("EMP-4", "Newbie New", { joiningDate: "2026-12-01" }), person("EMP-5", "Gone Inactive", { status: "inactive" }),
];
const attendance = {
  // Zara checked in late and is still waiting; Adam checked in early and was approved.
  [attendanceId("EMP-1", "2026-11-04")]: rec("EMP-1", "2026-11-04T10:20:00+05:30", "pending"),
  [attendanceId("EMP-2", "2026-11-04")]: rec("EMP-2", "2026-11-04T09:55:00+05:30", "approved"),
};

describe("today's roster", () => {
  it("matches the dashboard card numbers after the cutoff, and orders check-ins earliest first", () => {
    const db = make(attendance, employees);
    const ctx = at("2026-11-04T07:00:00Z"); // 12:30 IST, past 10:15
    const roster = selectTodayRoster(db, ctx);
    const overview = selectAdminOverview(db, ctx);

    expect(roster.present).toHaveLength(overview.presentToday);
    expect(roster.awaiting).toHaveLength(overview.awaitingApprovalToday);
    expect(roster.absent).toHaveLength(overview.absentToday);
    expect(roster.all).toHaveLength(overview.activeEmployees);
    // Present means approved: a check-in nobody has approved yet is not counted as present.
    expect(roster.present.map((r) => r.employee.id)).toEqual(["EMP-2"]);
    expect(overview.presentToday).toBe(1);
    expect(roster.awaiting.map((r) => r.employee.id)).toEqual(["EMP-1"]);
    expect(overview.awaitingApprovalToday).toBe(1);
    expect(roster.absent.map((r) => r.employee.id)).toEqual(["EMP-3"]);
    expect(roster.awaiting[0].record?.isLate).toBe(true);
    expect(roster.all.find((r) => r.employee.id === "EMP-4")?.state).toBe("not_expected");
    expect(roster.all.some((r) => r.employee.id === "EMP-5")).toBe(false); // inactive employees are excluded
  });

  it("never counts a waiting check-in as absent, and counts a rejected check-in as absent", () => {
    const rejected = {
      ...attendance,
      [attendanceId("EMP-1", "2026-11-04")]: rec("EMP-1", "2026-11-04T10:20:00+05:30", "rejected"),
    };
    const db = make(rejected, employees);
    const ctx = at("2026-11-04T07:00:00Z");
    const roster = selectTodayRoster(db, ctx);
    expect(roster.awaiting).toHaveLength(0);
    expect(roster.absent.map((r) => r.employee.id).sort()).toEqual(["EMP-1", "EMP-3"]);
    expect(roster.absent.find((r) => r.employee.id === "EMP-1")?.reason).toBe("Check-in rejected");
    expect(roster.absent).toHaveLength(selectAdminOverview(db, ctx).absentToday);

    // A pending check-in stays out of the absent list even long after the cutoff.
    const pendingOnly = selectTodayRoster(make(attendance, employees), at("2026-11-04T12:00:00Z"));
    expect(pendingOnly.absent.map((r) => r.employee.id)).toEqual(["EMP-3"]);
  });

  it("does not call someone absent before the cutoff", () => {
    const db = make(attendance, employees);
    const ctx = at("2026-11-04T03:45:00Z"); // 09:15 IST, before 10:15
    const roster = selectTodayRoster(db, ctx);
    expect(roster.absent).toHaveLength(0);
    expect(roster.all.find((r) => r.employee.id === "EMP-3")?.state).toBe("not_arrived");
    expect(roster.absent).toHaveLength(selectAdminOverview(db, ctx).absentToday);
  });

  it("marks everyone as not expected on a weekly off", () => {
    const db = make({}, employees);
    const roster = selectTodayRoster(db, at("2026-11-03T07:00:00Z")); // Tuesday
    expect(roster.present).toHaveLength(0);
    expect(roster.absent).toHaveLength(0);
    expect(roster.all.every((r) => r.state === "not_expected")).toBe(true);
    expect(roster.all[0].reason).toBe("Weekly off");
  });
});
