import { describe, expect, it } from "vitest";
import { attendanceId, bucketEntries, buildDayEntry, resolveRecord } from "@/lib/attendance-utils";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { createAttendanceContext } from "@/lib/selectors/context";
import type { AttendanceRecord } from "@/types/attendance";
import type { Database } from "@/types/database";
import type { Employee } from "@/types/employee";

const employee: Employee = {
  id: "EMP-1", fullName: "Test Person", email: "t@x.example", phone: "+91 90000 00000", department: "Eng",
  designation: "Dev", joiningDate: "2025-01-01", monthlyBasicSalary: 30000, status: "active",
};
// Wednesday 2026-11-04, 12:30 IST.
const ctx = createAttendanceContext({ settings: structuredClone(DEFAULT_SETTINGS), holidays: [], clockOffsetMs: 0 } as unknown as Database, new Date("2026-11-04T07:00:00Z").getTime());

const open = (date: string, approval: AttendanceRecord["approval"]): AttendanceRecord => ({
  id: attendanceId(employee.id, date), employeeId: employee.id, date, checkIn: `${date}T10:05:00+05:30`, checkOut: null,
  status: "in_progress", approval,
});

describe("checking in and getting approved", () => {
  it("shows an unapproved open check-in as in progress and pending", () => {
    const entry = buildDayEntry(employee, "2026-11-04", open("2026-11-04", "pending"), ctx);
    expect(entry.attendanceStatus).toBe("in_progress");
    expect(entry.approvalStatus).toBe("pending");
  });

  it("shows Present the moment the admin approves an open check-in", () => {
    const record = open("2026-11-04", "approved");
    expect(resolveRecord(record, ctx).effectiveStatus).toBe("present");
    const entry = buildDayEntry(employee, "2026-11-04", record, ctx);
    expect(entry.attendanceStatus).toBe("present");
    expect(entry.approvalStatus).toBe("approved");
    expect(entry.display).toBe("approved");
  });

  it("counts an approved open check-in as a present day in the monthly buckets", () => {
    const entry = buildDayEntry(employee, "2026-11-04", open("2026-11-04", "approved"), ctx);
    const buckets = bucketEntries([entry], ctx);
    expect(buckets.approvedFullDays).toBe(1);
    expect(buckets.pendingDays).toBe(0);
  });

  it("does not let an approved check-in that was never checked out pass as a full day later", () => {
    const record = open("2026-11-03", "approved"); // yesterday, still open, approved while the employee was in
    expect(resolveRecord(record, ctx).effectiveStatus).toBe("incomplete");
    const buckets = bucketEntries([buildDayEntry(employee, "2026-11-03", record, ctx)], ctx);
    expect(buckets.approvedFullDays).toBe(0);
    expect(buckets.incompleteDays).toBe(1);
  });

  it("keeps a rejected open check-in rejected", () => {
    const entry = buildDayEntry(employee, "2026-11-04", open("2026-11-04", "rejected"), ctx);
    expect(entry.display).toBe("rejected");
  });
});
