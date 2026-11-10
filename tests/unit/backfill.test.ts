import { describe, expect, it } from "vitest";
import {
  BACKFILL_REMARK,
  buildBackfillTemplate,
  parseBackfillCsv,
  planBackfillEntry,
  type BackfillEntry,
  type PlanContext,
} from "@/lib/backfill";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { Employee } from "@/types/employee";

const employee: Employee = {
  id: "EMP-1001", fullName: "Test Person", email: "t@x.example", phone: "+91 90000 00000", department: "Eng",
  designation: "Dev", joiningDate: "2026-10-05", monthlyBasicSalary: 30000, status: "active",
};
const base: PlanContext = {
  policy: { ...DEFAULT_SETTINGS.attendance, weeklyOffs: [2] }, // 10:00 to 18:30, 8 required hours, 4 hour half-day threshold, Tuesday off
  holidays: { "2026-10-20": "Diwali" },
  employee, today: "2026-11-04", existing: null, locked: false, allowedMonths: ["2026-10"],
};
const entry = (over: Partial<BackfillEntry> = {}): BackfillEntry => ({ employeeId: "EMP-1001", date: "2026-10-14", status: "present", ...over });
const plan = (e: BackfillEntry, ctx: Partial<PlanContext> = {}) => planBackfillEntry(e, { ...base, ...ctx });

describe("backfill rules", () => {
  it("saves a present day with the office hours by default", () => {
    expect(plan(entry())).toEqual({
      ok: true, action: "save", status: "present",
      checkIn: "2026-10-14T10:00:00+05:30", checkOut: "2026-10-14T18:30:00+05:30",
    });
  });

  it("defaults a half day to the half-day threshold, and honours explicit times", () => {
    expect(plan(entry({ status: "half_day" }))).toMatchObject({ checkIn: "2026-10-14T10:00:00+05:30", checkOut: "2026-10-14T14:00:00+05:30" });
    expect(plan(entry({ checkIn: "09:30", checkOut: "17:45" }))).toMatchObject({ checkIn: "2026-10-14T09:30:00+05:30", checkOut: "2026-10-14T17:45:00+05:30" });
  });

  it("treats absent as clearing the day", () => {
    expect(plan(entry({ status: "absent" }))).toEqual({ ok: true, action: "clear" });
  });

  it.each([
    ["a month that isn't open", entry({ date: "2026-09-10" }), {}, "Only 2026-10"],
    ["the future", entry({ date: "2026-10-14" }), { today: "2026-10-10" }, "future"],
    ["a day before joining", entry({ date: "2026-10-01" }), {}, "joined on 2026-10-05"],
    ["a weekly off (Tuesday)", entry({ date: "2026-10-13" }), {}, "weekly off"],
    ["a holiday", entry({ date: "2026-10-20" }), {}, "holiday (Diwali)"],
    ["a finalized month", entry(), { locked: true }, "finalized"],
    ["an unknown employee", entry(), { employee: undefined }, "Unknown employee"],
    ["a real check-in record", entry(), { existing: { remarks: null } }, "real check-in"],
    ["check-out before check-in", entry({ checkIn: "15:00", checkOut: "09:00" }), {}, "after check-in"],
    ["a badly formatted time", entry({ checkIn: "9.30" }), {}, "09:30"],
    ["an impossible shift", entry({ checkIn: "01:00", checkOut: "23:00" }), {}, "20 hours"],
  ])("refuses %s", (_name, e, ctx, message) => {
    const result = plan(e, ctx as Partial<PlanContext>);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain(message);
  });

  it("may overwrite a day that an earlier backfill entered, but not a real one", () => {
    expect(plan(entry({ status: "half_day" }), { existing: { remarks: BACKFILL_REMARK } }).ok).toBe(true);
  });

  it("refuses days after a deactivation", () => {
    const result = plan(entry({ date: "2026-10-15" }), { employee: { ...employee, deactivatedOn: "2026-10-10" } });
    expect(result.ok).toBe(false);
  });
});

describe("backfill CSV", () => {
  it("parses a sheet with friendly status words and optional times", () => {
    const csv = [
      "employee_id,employee_name,date,status,check_in,check_out",
      'EMP-1001,"Person, Test",2026-10-14,Present,,',
      "emp-1002,Other,2026-10-14,H,10:00,14:00",
      "EMP-1002,Other,2026-10-15,half day,,",
      "EMP-1002,Other,2026-10-16,A,,",
      "EMP-1002,Other,2026-10-17,,,", // blank status: skipped on purpose
    ].join("\r\n");
    const parsed = parseBackfillCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.skipped).toBe(1);
    expect(parsed.entries).toEqual([
      { employeeId: "EMP-1001", date: "2026-10-14", status: "present" },
      { employeeId: "EMP-1002", date: "2026-10-14", status: "half_day", checkIn: "10:00", checkOut: "14:00" },
      { employeeId: "EMP-1002", date: "2026-10-15", status: "half_day" },
      { employeeId: "EMP-1002", date: "2026-10-16", status: "absent" },
    ]);
  });

  it("reports bad rows with their line numbers instead of guessing", () => {
    const csv = ["employee_id,date,status", "EMP-1001,14/10/2026,present", "EMP-1001,2026-10-14,maybe", ",2026-10-14,present", "EMP-1001,2026-10-15,present", "EMP-1001,2026-10-15,absent"].join("\n");
    const { errors, entries } = parseBackfillCsv(csv);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 6]);
    expect(errors[0].message).toContain("YYYY-MM-DD");
    expect(errors[3].message).toContain("more than once");
    expect(entries).toHaveLength(1);
  });

  it("explains a missing header and an empty file", () => {
    expect(parseBackfillCsv("name,when\nA,B").errors[0].message).toContain("employee_id, date and status");
    expect(parseBackfillCsv("   \n").errors[0].message).toContain("empty");
  });

  it("builds a template that parses back with every row skipped", () => {
    const template = buildBackfillTemplate([
      { employeeId: "EMP-1001", name: 'Test, "Quoted"', date: "2026-10-14" },
      { employeeId: "EMP-1001", name: 'Test, "Quoted"', date: "2026-10-15" },
    ]);
    const parsed = parseBackfillCsv(template);
    expect(parsed.errors).toEqual([]);
    expect(parsed.entries).toEqual([]);
    expect(parsed.skipped).toBe(2);
  });
});

describe("week off", () => {
  it("is saved without times, and is never counted as an absence or a working day", () => {
    const result = planBackfillEntry({ employeeId: "EMP-1001", date: "2026-10-14", status: "week_off" }, {
      policy: { ...DEFAULT_SETTINGS.attendance, weeklyOffs: [2] }, holidays: {}, employee, today: "2026-11-04", existing: null, locked: false, allowedMonths: ["2026-10"],
    });
    expect(result).toEqual({ ok: true, action: "save", status: "week_off", checkIn: null, checkOut: null });
  });

  it("reads week off words from a CSV", () => {
    const parsed = parseBackfillCsv("employee_id,date,status\nEMP-1001,2026-10-14,week off\nEMP-1001,2026-10-15,WO\n");
    expect(parsed.entries.map((e) => e.status)).toEqual(["week_off", "week_off"]);
  });
});
