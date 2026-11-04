import {
  attendanceId,
  buildHolidayMap,
  deriveStatusFromWorkedMinutes,
  isWorkingDay,
  summarizeMonth,
  type AttendanceContext,
} from "@/lib/attendance-utils";
import { DB_VERSION, DEFAULT_SETTINGS } from "@/lib/constants";
import {
  addDays,
  diffInDays,
  eachDay,
  minutesOfDay,
  monthOf,
  monthStart,
  parseClockTime,
  shiftMonth,
  timestampOn,
  toDateKey,
  toIstTimestamp,
} from "@/lib/date-utils";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/format";
import { withSeedProfiles } from "@/lib/mock-profiles";
import { isEmployeeInPayrollMonth, payDateFor, payrollId } from "@/lib/payroll-utils";
import { buildPayrollSnapshot } from "@/lib/salary-calculator";
import { SEEDED_HISTORY_MONTHS } from "@/lib/selectors/context";
import type {
  ApprovalStatus,
  AttendanceRecord,
  Holiday,
  RecordStatus,
} from "@/types/attendance";
import type { DateKey, IsoTimestamp } from "@/types/common";
import type { Database } from "@/types/database";
import type { AdminUser, Employee } from "@/types/employee";
import type { AppNotification } from "@/types/notification";
import type { PayrollRecord } from "@/types/payroll";
import type { AppSettings } from "@/types/settings";

/**
 * Seed data for the frontend demo.
 *
 * Everything is generated relative to "today" so the current month always
 * looks lived-in, and every attendance day is derived from a seeded random
 * generator keyed on `employee + date`, so the same day always produces the
 * same record no matter when the demo is opened.
 */

export const DEMO_EMPLOYEE_ID = "EMP-1001";
export const DEMO_ADMIN_ID = "ADM-001";

/* ---------------------------------- random ---------------------------------- */

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** Small deterministic PRNG (mulberry32) so seeded days never change between loads. */
export function createRng(seed: string): () => number {
  let a = xmur3(seed)();
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: () => number, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const between = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/* --------------------------------- holidays --------------------------------- */

const FIXED_HOLIDAYS = [
  { monthDay: "01-26", name: "Republic Day" },
  { monthDay: "05-01", name: "Labour Day" },
  { monthDay: "08-15", name: "Independence Day" },
  { monthDay: "10-02", name: "Gandhi Jayanti" },
  { monthDay: "12-25", name: "Christmas Day" },
];

/** Demo company calendar. Festival dates are only provided for 2026. */
const FESTIVAL_HOLIDAYS: Holiday[] = [
  { date: "2026-03-04", name: "Holi" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-08", name: "Diwali" },
];

export function buildHolidays(years: number[]): Holiday[] {
  const holidays: Holiday[] = [];
  for (const year of years) {
    for (const holiday of FIXED_HOLIDAYS) {
      holidays.push({ date: `${year}-${holiday.monthDay}`, name: holiday.name });
    }
  }
  holidays.push(...FESTIVAL_HOLIDAYS.filter((h) => years.includes(Number(h.date.slice(0, 4)))));
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/* --------------------------------- people ----------------------------------- */

const ADMINS: AdminUser[] = [
  {
    id: DEMO_ADMIN_ID,
    fullName: "Neha Kapoor",
    email: "neha.kapoor@kestrel.example",
    title: "HR Manager",
  },
];

function buildEmployees(today: DateKey): Employee[] {
  const active = (e: Omit<Employee, "status">): Employee => ({ ...e, status: "active" });
  return [
    active({
      id: "EMP-1001",
      fullName: "Aarav Sharma",
      email: "aarav.sharma@kestrel.example",
      phone: "+91 90000 10001",
      department: "Engineering",
      designation: "Associate Software Engineer",
      joiningDate: "2024-06-10",
      monthlyBasicSalary: 30_000,
    }),
    active({
      id: "EMP-1002",
      fullName: "Priya Nair",
      email: "priya.nair@kestrel.example",
      phone: "+91 90000 10002",
      department: "Engineering",
      designation: "Senior Software Engineer",
      joiningDate: "2022-03-14",
      monthlyBasicSalary: 85_000,
    }),
    active({
      id: "EMP-1003",
      fullName: "Rohan Mehta",
      email: "rohan.mehta@kestrel.example",
      phone: "+91 90000 10003",
      department: "Sales",
      designation: "Sales Manager",
      joiningDate: "2021-09-01",
      monthlyBasicSalary: 72_000,
    }),
    active({
      id: "EMP-1004",
      fullName: "Ananya Iyer",
      email: "ananya.iyer@kestrel.example",
      phone: "+91 90000 10004",
      department: "Design",
      designation: "Product Designer",
      joiningDate: "2023-01-16",
      monthlyBasicSalary: 58_000,
    }),
    active({
      id: "EMP-1005",
      fullName: "Vikram Singh",
      email: "vikram.singh@kestrel.example",
      phone: "+91 90000 10005",
      department: "Operations",
      designation: "Operations Executive",
      joiningDate: "2023-07-03",
      monthlyBasicSalary: 38_000,
    }),
    active({
      id: "EMP-1006",
      fullName: "Sneha Kulkarni",
      email: "sneha.kulkarni@kestrel.example",
      phone: "+91 90000 10006",
      department: "Human Resources",
      designation: "HR Executive",
      joiningDate: "2022-11-21",
      monthlyBasicSalary: 42_000,
    }),
    active({
      id: "EMP-1007",
      fullName: "Karthik Reddy",
      email: "karthik.reddy@kestrel.example",
      phone: "+91 90000 10007",
      department: "Finance",
      designation: "Accounts Analyst",
      joiningDate: "2024-02-05",
      monthlyBasicSalary: 46_000,
    }),
    active({
      id: "EMP-1008",
      fullName: "Meera Joshi",
      email: "meera.joshi@kestrel.example",
      phone: "+91 90000 10008",
      department: "Marketing",
      designation: "Marketing Specialist",
      joiningDate: "2023-10-09",
      monthlyBasicSalary: 52_000,
    }),
    active({
      id: "EMP-1009",
      fullName: "Arjun Patel",
      email: "arjun.patel@kestrel.example",
      phone: "+91 90000 10009",
      department: "Customer Support",
      designation: "Support Executive",
      // A recent joiner shows how payroll treats a part month.
      joiningDate: addDays(today, -40),
      monthlyBasicSalary: 28_000,
    }),
    {
      id: "EMP-1010",
      fullName: "Fatima Khan",
      email: "fatima.khan@kestrel.example",
      phone: "+91 90000 10010",
      department: "Engineering",
      designation: "QA Engineer",
      joiningDate: "2023-05-22",
      monthlyBasicSalary: 48_000,
      status: "inactive",
      deactivatedOn: addDays(today, -18),
    },
    active({
      id: "EMP-1011",
      fullName: "Rahul Verma",
      email: "rahul.verma@kestrel.example",
      phone: "+91 90000 10011",
      department: "Sales",
      designation: "Sales Executive",
      joiningDate: "2024-09-02",
      monthlyBasicSalary: 35_000,
    }),
  ];
}

/* ------------------------------- attendance --------------------------------- */

interface Profile {
  absent: number;
  late: number;
  half: number;
  forgot: number;
}

const DEFAULT_PROFILE: Profile = { absent: 0.04, late: 0.08, half: 0.04, forgot: 0.01 };

const PROFILES: Record<string, Profile> = {
  "EMP-1001": { absent: 0.03, late: 0.05, half: 0.05, forgot: 0 },
  "EMP-1002": { absent: 0.02, late: 0.03, half: 0.02, forgot: 0.01 },
  "EMP-1003": { absent: 0.04, late: 0.1, half: 0.05, forgot: 0.01 },
  "EMP-1004": { absent: 0.03, late: 0.06, half: 0.03, forgot: 0 },
  "EMP-1005": { absent: 0.05, late: 0.14, half: 0.06, forgot: 0.01 },
  "EMP-1006": { absent: 0.02, late: 0.04, half: 0.03, forgot: 0 },
  "EMP-1007": { absent: 0.03, late: 0.07, half: 0.04, forgot: 0.01 },
  "EMP-1008": { absent: 0.04, late: 0.09, half: 0.04, forgot: 0 },
  "EMP-1009": { absent: 0.06, late: 0.16, half: 0.07, forgot: 0.02 },
  "EMP-1010": { absent: 0.05, late: 0.08, half: 0.05, forgot: 0.01 },
  "EMP-1011": { absent: 0.04, late: 0.08, half: 0.05, forgot: 0 },
};

const NORMAL_REMARKS = [
  "Work from home",
  "Client visit",
  "Team offsite",
  "Project deadline",
  "On-site support",
  "Training session",
] as const;
const LATE_REMARKS = ["Traffic delay", "Train delay", "Heavy rain", "Personal errand"] as const;
const HALF_REMARKS = [
  "Left early for a medical appointment",
  "Personal work in the afternoon",
  "Family function",
  "Bank work",
] as const;
const ABSENCE_REMARKS = ["Sick leave", "Casual leave", "Personal leave", "Family emergency"] as const;
const REJECTION_REASONS = [
  "Check-in could not be verified against the roster.",
  "Duplicate entry for the same shift.",
  "Working hours did not match the approved shift.",
  "No manager confirmation for the work-from-home request.",
] as const;

/** Employees seeded as being on approved leave today, so "Absent Today" is never empty. */
const ON_LEAVE_TODAY = new Set(["EMP-1008"]);

interface SeedContext extends AttendanceContext {
  currentMonthStart: DateKey;
  windowStart: DateKey;
  adminId: string;
}

type SeedOutcome = "full" | "half" | "incomplete" | "absent_explicit" | "absent_implicit";

interface Override {
  outcome: SeedOutcome;
  approval: Exclude<ApprovalStatus, "not_required">;
  remarks?: string;
  reason?: string;
}

function recentWorkingDays(sc: SeedContext, count: number): DateKey[] {
  const days: DateKey[] = [];
  let cursor = addDays(sc.today, -1);
  while (days.length < count && diffInDays(sc.today, cursor) < 60) {
    if (isWorkingDay(cursor, sc)) days.push(cursor);
    cursor = addDays(cursor, -1);
  }
  return days;
}

/** Hand-written story for the demo employee so their dashboard shows every kind of state. */
function demoEmployeeOverrides(sc: SeedContext): Map<DateKey, Override> {
  const plan: Override[] = [
    { outcome: "full", approval: "pending", remarks: "Work from home" },
    { outcome: "full", approval: "pending" },
    { outcome: "full", approval: "approved" },
    { outcome: "incomplete", approval: "pending", remarks: "Forgot to check out" },
    {
      outcome: "full",
      approval: "rejected",
      reason: "Check-in could not be verified. Share your manager's confirmation and resubmit.",
    },
    { outcome: "half", approval: "approved", remarks: "Left early for a medical appointment" },
    { outcome: "full", approval: "approved" },
  ];
  const overrides = new Map<DateKey, Override>();
  recentWorkingDays(sc, plan.length)
    .filter((date) => date >= sc.currentMonthStart)
    .forEach((date, index) => overrides.set(date, plan[index]));
  return overrides;
}

/**
 * A seeded event can land after "now" (for example yesterday's approval, which
 * would be stamped this afternoon). It is moved to earlier today instead, and
 * spread out by `salt` so a batch of them doesn't all read "10 min ago".
 */
function clampToPast(timestamp: IsoTimestamp, nowMs: number, salt: string): IsoTimestamp {
  if (new Date(timestamp).getTime() <= nowMs) return timestamp;
  const minutesAgo = 6 + Math.floor(createRng(salt)() * 150);
  return toIstTimestamp(new Date(nowMs - minutesAgo * 60_000));
}

function buildSeedRecord(
  employee: Employee,
  date: DateKey,
  sc: SeedContext,
  override?: Override,
): AttendanceRecord | null {
  const rng = createRng(`${employee.id}|${date}`);
  const profile = PROFILES[employee.id] ?? DEFAULT_PROFILE;
  const id = attendanceId(employee.id, date);
  const isCurrentMonth = date >= sc.currentMonthStart;
  const daysAgo = diffInDays(sc.today, date);

  let outcome: SeedOutcome;
  if (override) {
    outcome = override.outcome;
  } else {
    const roll = rng();
    if (roll < profile.absent) outcome = rng() < 0.65 ? "absent_explicit" : "absent_implicit";
    else if (roll < profile.absent + profile.half) outcome = "half";
    else if (roll < profile.absent + profile.half + profile.forgot) outcome = "incomplete";
    else outcome = "full";
  }

  if (outcome === "absent_implicit") return null;
  if (outcome === "absent_explicit") {
    return {
      id,
      employeeId: employee.id,
      date,
      checkIn: null,
      checkOut: null,
      status: "absent",
      approval: "not_required",
      remarks: pick(rng, ABSENCE_REMARKS),
    };
  }

  const startMinutes = parseClockTime(sc.policy.officeStartTime);
  const isLate = rng() < profile.late;
  const inMinutes = startMinutes + (isLate ? between(rng, 18, 65) : between(rng, -24, 12));
  const workedMinutes =
    outcome === "full"
      ? between(rng, 8 * 60 + 4, 9 * 60 + 45)
      : outcome === "half"
        ? between(rng, 4 * 60 + 8, 6 * 60 + 25)
        : null;

  const status: RecordStatus =
    workedMinutes === null ? "incomplete" : deriveStatusFromWorkedMinutes(workedMinutes, sc.policy);

  let approval: ApprovalStatus;
  if (override) {
    approval = override.approval;
  } else if (outcome === "incomplete") {
    approval = isCurrentMonth ? "pending" : "rejected";
  } else if (isCurrentMonth) {
    if (daysAgo <= 2) {
      approval = rng() < 0.5 ? "pending" : "approved";
    } else {
      const roll = rng();
      approval = roll < 0.03 ? "rejected" : roll < 0.05 ? "pending" : "approved";
    }
  } else {
    approval = rng() < 0.03 ? "rejected" : "approved";
  }

  let remarks = override?.remarks;
  if (!override) {
    if (outcome === "incomplete") remarks = "Forgot to check out";
    else if (outcome === "half") remarks = pick(rng, HALF_REMARKS);
    else if (isLate && rng() < 0.55) remarks = pick(rng, LATE_REMARKS);
    else if (rng() < 0.12) remarks = pick(rng, NORMAL_REMARKS);
  }

  const record: AttendanceRecord = {
    id,
    employeeId: employee.id,
    date,
    checkIn: timestampOn(date, inMinutes),
    checkOut: workedMinutes === null ? null : timestampOn(date, inMinutes + workedMinutes),
    status,
    approval,
    remarks,
  };

  if (approval === "approved" || approval === "rejected") {
    record.reviewedAt = clampToPast(
      timestampOn(addDays(date, 1), between(rng, 10 * 60, 13 * 60 + 30)),
      sc.nowMs,
      `${id}|reviewed`,
    );
    record.reviewedBy = sc.adminId;
    if (approval === "rejected") {
      record.rejectionReason =
        override?.reason ??
        (outcome === "incomplete"
          ? "No check-out was recorded and the day was not regularized in time."
          : pick(rng, REJECTION_REASONS));
    }
  }
  return record;
}

/** Today's activity for the rest of the team, limited to what has "happened" by the current time. */
function buildTodayRecord(employee: Employee, sc: SeedContext): AttendanceRecord | null {
  const id = attendanceId(employee.id, sc.today);
  if (ON_LEAVE_TODAY.has(employee.id)) {
    return {
      id,
      employeeId: employee.id,
      date: sc.today,
      checkIn: null,
      checkOut: null,
      status: "absent",
      approval: "not_required",
      remarks: "Approved leave",
    };
  }

  const rng = createRng(`${employee.id}|${sc.today}|today`);
  const profile = PROFILES[employee.id] ?? DEFAULT_PROFILE;
  const startMinutes = parseClockTime(sc.policy.officeStartTime);
  const isLate = rng() < Math.min(0.35, profile.late * 2);
  const inMinutes = startMinutes + (isLate ? between(rng, 18, 50) : between(rng, -22, 10));
  const nowMinutes = minutesOfDay(new Date(sc.nowMs));
  if (inMinutes > nowMinutes) return null;

  const outMinutes = inMinutes + between(rng, 8 * 60 + 6, 9 * 60 + 20);
  const checkedOut = outMinutes <= nowMinutes;
  return {
    id,
    employeeId: employee.id,
    date: sc.today,
    checkIn: timestampOn(sc.today, inMinutes),
    checkOut: checkedOut ? timestampOn(sc.today, outMinutes) : null,
    status: checkedOut ? deriveStatusFromWorkedMinutes(outMinutes - inMinutes, sc.policy) : "in_progress",
    approval: "pending",
    remarks: isLate && rng() < 0.5 ? pick(rng, LATE_REMARKS) : undefined,
  };
}

function seedAttendance(employees: Employee[], sc: SeedContext): Record<string, AttendanceRecord> {
  const records: Record<string, AttendanceRecord> = {};
  const demoOverrides = demoEmployeeOverrides(sc);
  const yesterday = addDays(sc.today, -1);

  for (const employee of employees) {
    const start = employee.joiningDate > sc.windowStart ? employee.joiningDate : sc.windowStart;
    const end = employee.deactivatedOn && employee.deactivatedOn < yesterday ? employee.deactivatedOn : yesterday;

    for (const date of eachDay(start, end)) {
      if (!isWorkingDay(date, sc)) continue;
      const override = employee.id === DEMO_EMPLOYEE_ID ? demoOverrides.get(date) : undefined;
      const record = buildSeedRecord(employee, date, sc, override);
      if (record) records[record.id] = record;
    }

    const worksToday =
      employee.status === "active" &&
      employee.id !== DEMO_EMPLOYEE_ID &&
      employee.joiningDate <= sc.today &&
      isWorkingDay(sc.today, sc);
    if (worksToday) {
      const record = buildTodayRecord(employee, sc);
      if (record) records[record.id] = record;
    }
  }
  return records;
}

/* ---------------------------------- payroll --------------------------------- */

function seedPayroll(
  employees: Employee[],
  attendance: Record<string, AttendanceRecord>,
  settings: AppSettings,
  sc: SeedContext,
): Record<string, PayrollRecord> {
  const payroll: Record<string, PayrollRecord> = {};
  const current = monthOf(sc.today);

  for (let back = SEEDED_HISTORY_MONTHS; back >= 1; back--) {
    const { year, month } = shiftMonth(current, -back);
    const next = shiftMonth({ year, month }, 1);
    const payDate = payDateFor(year, month, settings.salary.payDay);
    const payDatePassed = payDate <= sc.today;

    employees.forEach((employee, index) => {
      if (!isEmployeeInPayrollMonth(employee, year, month)) return;

      const summary = summarizeMonth(employee, attendance, year, month, sc);
      const snapshot = buildPayrollSnapshot(employee.monthlyBasicSalary, summary, settings.salary);

      const recordId = payrollId(employee.id, year, month);
      const generatedAt = clampToPast(
        timestampOn(monthStart(next.year, next.month), 10 * 60),
        sc.nowMs,
        `${recordId}|generated`,
      );
      const finalizedAt = clampToPast(
        timestampOn(addDays(monthStart(next.year, next.month), 1), 18 * 60),
        sc.nowMs,
        `${recordId}|finalized`,
      );
      // Last month: a few salaries are still waiting to be paid, which keeps "Mark as Paid" demonstrable.
      const paid = back >= 2 || (payDatePassed && index % 3 !== 2);

      const record: PayrollRecord = {
        id: recordId,
        employeeId: employee.id,
        year,
        month,
        status: paid ? "paid" : "finalized",
        generatedAt,
        finalizedAt,
        finalizedBy: sc.adminId,
        snapshot,
      };

      if (paid) {
        const paidAt = clampToPast(timestampOn(payDate, 11 * 60 + 30), sc.nowMs, `${recordId}|paid`);
        record.paidAt = new Date(paidAt) < new Date(finalizedAt) ? finalizedAt : paidAt;
        record.paymentReference = `NEFT-${String(year).slice(2)}${String(month).padStart(2, "0")}-${String(index + 1).padStart(4, "0")}`;
      }
      payroll[record.id] = record;
    });
  }
  return payroll;
}

/* ------------------------------- notifications ------------------------------- */

function seedNotifications(
  employees: Employee[],
  attendance: Record<string, AttendanceRecord>,
  payroll: Record<string, PayrollRecord>,
  holidays: Holiday[],
  sc: SeedContext,
): AppNotification[] {
  const notifications: AppNotification[] = [];
  let counter = 0;
  const add = (n: Omit<AppNotification, "id">) => notifications.push({ ...n, id: `ntf_seed_${++counter}` });
  const nowMs = sc.nowMs;
  const hoursAgo = (hours: number) => toIstTimestamp(new Date(nowMs - hours * 3_600_000));

  const demoRecords = Object.values(attendance)
    .filter((r) => r.employeeId === DEMO_EMPLOYEE_ID)
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastApproved = demoRecords.find((r) => r.approval === "approved" && r.reviewedAt);
  const lastRejected = demoRecords.find((r) => r.approval === "rejected" && r.reviewedAt);
  const lastIncomplete = demoRecords.find(
    (r) => r.status === "incomplete" || (r.status === "in_progress" && r.date < sc.today),
  );

  if (lastRejected) {
    add({
      recipient: DEMO_EMPLOYEE_ID,
      type: "attendance_rejected",
      title: "Attendance rejected",
      message: `Your attendance for ${formatDate(lastRejected.date)} was rejected: ${lastRejected.rejectionReason}`,
      createdAt: lastRejected.reviewedAt!,
      read: false,
      href: "/employee/attendance",
    });
  }
  if (lastIncomplete) {
    add({
      recipient: DEMO_EMPLOYEE_ID,
      type: "attendance_reminder",
      title: "Check-out missing",
      message: `You checked in on ${formatDate(lastIncomplete.date)} but there is no check-out. Ask an administrator to regularize it.`,
      createdAt: timestampOn(addDays(lastIncomplete.date, 1), 9 * 60),
      read: false,
      href: "/employee/attendance",
    });
  }
  if (lastApproved) {
    add({
      recipient: DEMO_EMPLOYEE_ID,
      type: "attendance_approved",
      title: "Attendance approved",
      message: `Your attendance for ${formatDate(lastApproved.date)} was approved.`,
      createdAt: lastApproved.reviewedAt!,
      read: true,
      href: "/employee/attendance",
    });
  }

  const demoPayroll = Object.values(payroll)
    .filter((p) => p.employeeId === DEMO_EMPLOYEE_ID)
    .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));
  for (const record of demoPayroll.slice(0, 2)) {
    const label = formatMonthYear(record.year, record.month);
    add({
      recipient: DEMO_EMPLOYEE_ID,
      type: "payroll_finalized",
      title: `${label} payroll finalized`,
      message: `Your salary for ${label} was finalized at ${formatCurrency(record.snapshot?.estimatedSalary ?? 0)}.`,
      createdAt: record.finalizedAt ?? record.generatedAt,
      read: true,
      href: "/employee/salary",
    });
    if (record.status === "paid" && record.paidAt) {
      add({
        recipient: DEMO_EMPLOYEE_ID,
        type: "payroll_paid",
        title: `${label} salary marked as paid`,
        message: `Payment reference ${record.paymentReference}.`,
        createdAt: record.paidAt,
        read: true,
        href: "/employee/salary",
      });
    }
  }

  const upcoming = holidays.find((h) => h.date > sc.today && diffInDays(h.date, sc.today) <= 30);
  for (const employee of employees.filter((e) => e.status === "active")) {
    add({
      recipient: employee.id,
      type: "policy_update",
      title: "Attendance policy reminder",
      message: `Office hours are ${sc.policy.officeStartTime} to ${sc.policy.officeEndTime}. Check in within ${sc.policy.lateGraceMinutes} minutes of the start time to avoid a late mark.`,
      createdAt: hoursAgo(24 * 9),
      read: employee.id !== DEMO_EMPLOYEE_ID,
      href: "/employee/attendance",
    });
    if (upcoming) {
      add({
        recipient: employee.id,
        type: "holiday",
        title: `Upcoming holiday: ${upcoming.name}`,
        message: `The office is closed on ${formatDate(upcoming.date, "long")}.`,
        createdAt: hoursAgo(24 * 2),
        read: employee.id !== DEMO_EMPLOYEE_ID,
      });
    }
  }

  const pendingCount = Object.values(attendance).filter((r) => r.approval === "pending").length;
  if (pendingCount > 0) {
    add({
      recipient: "admin",
      type: "attendance_submitted",
      title: "Attendance waiting for review",
      message: `${pendingCount} attendance ${pendingCount === 1 ? "request needs" : "requests need"} your approval.`,
      createdAt: hoursAgo(0.4),
      read: false,
      href: "/admin/attendance",
    });
  }
  const unpaid = Object.values(payroll).filter((p) => p.status === "finalized");
  if (unpaid.length > 0) {
    const sample = unpaid[0];
    add({
      recipient: "admin",
      type: "payroll_finalized",
      title: "Salaries awaiting payment",
      message: `${unpaid.length} finalized ${unpaid.length === 1 ? "salary is" : "salaries are"} still unpaid for ${formatMonthYear(sample.year, sample.month)}.`,
      createdAt: hoursAgo(5),
      read: false,
      href: "/admin/payroll",
    });
  }
  return notifications;
}

/* ------------------------------- demo clock anchor ------------------------------ */

/** If the real time falls in this window of a working day, the demo simply runs on real time. */
const COMFORT_WINDOW = { start: 8 * 60 + 30, end: 13 * 60 + 30 };
/**
 * Otherwise the demo clock starts here: 9:40 AM, inside the late-arrival grace
 * period, so a first check-in is on time and a full working day fits before midnight.
 */
const ANCHOR_MINUTES = 9 * 60 + 40;

/**
 * Chooses the demo clock's starting offset. Someone opening the demo at 9 PM
 * (or on a Sunday) could not otherwise test a check-in followed by a full
 * working day without crossing midnight, so the demo starts at 9:40 AM on
 * the nearest working day. The offset is stored and can be cleared from the
 * Demo menu at any time.
 */
export function computeInitialClockOffset(realNow: Date): number {
  const today = toDateKey(realNow);
  const year = Number(today.slice(0, 4));
  const calendar = {
    policy: DEFAULT_SETTINGS.attendance,
    holidays: buildHolidayMap(buildHolidays([year - 1, year, year + 1])),
  };

  const workingToday = isWorkingDay(today, calendar);
  const minutes = minutesOfDay(realNow);
  if (workingToday && minutes >= COMFORT_WINDOW.start && minutes <= COMFORT_WINDOW.end) return 0;

  let date = today;
  if (!workingToday) {
    date = addDays(today, 1);
    for (let guard = 0; guard < 14 && !isWorkingDay(date, calendar); guard++) date = addDays(date, 1);
  }
  return new Date(timestampOn(date, ANCHOR_MINUTES)).getTime() - realNow.getTime();
}

/** Fresh demo data, generated as of the (possibly adjusted) demo time. */
export function createDemoDatabase(realNow: Date = new Date()): Database {
  const offset = computeInitialClockOffset(realNow);
  const db = createSeedDatabase(new Date(realNow.getTime() + offset));
  return { ...db, clockOffsetMs: offset };
}

/* --------------------------------- entry point -------------------------------- */

export function createSeedDatabase(now: Date = new Date()): Database {
  const nowMs = now.getTime();
  const today = toDateKey(now);
  const current = monthOf(today);
  const windowStartMonth = shiftMonth(current, -SEEDED_HISTORY_MONTHS);

  const settings: AppSettings = structuredClone(DEFAULT_SETTINGS);
  const holidays = buildHolidays([current.year - 1, current.year, current.year + 1]);
  const sc: SeedContext = {
    today,
    nowMs,
    policy: settings.attendance,
    holidays: buildHolidayMap(holidays),
    currentMonthStart: monthStart(current.year, current.month),
    windowStart: monthStart(windowStartMonth.year, windowStartMonth.month),
    adminId: DEMO_ADMIN_ID,
  };

  const employees = withSeedProfiles(buildEmployees(today), toIstTimestamp(now));
  const attendance = seedAttendance(employees, sc);
  const payroll = seedPayroll(employees, attendance, settings, sc);
  const notifications = seedNotifications(employees, attendance, payroll, holidays, sc);

  return {
    version: DB_VERSION,
    seededAt: toIstTimestamp(now),
    clockOffsetMs: 0,
    settings,
    admins: ADMINS.map((admin) => ({ ...admin })),
    employees,
    attendance,
    payroll,
    notifications,
    holidays,
  };
}
