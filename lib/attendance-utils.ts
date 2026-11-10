import {
  eachDayOfMonth,
  getWeekday,
  minutesBetween,
  minutesOfDay,
  parseClockTime,
} from "@/lib/date-utils";
import { formatDuration } from "@/lib/format";
import type {
  ApprovalStatus,
  AttendanceRecord,
  AttendanceStatus,
  DayDisplayStatus,
  Holiday,
  RecordStatus,
} from "@/types/attendance";
import type { DateKey, IsoTimestamp } from "@/types/common";
import type { Employee } from "@/types/employee";
import type { AttendancePolicy } from "@/types/settings";

/**
 * Pure attendance rules. Nothing in here reads the store or the clock; the
 * caller passes an `AttendanceContext`, which keeps every rule easy to test
 * and easy to move to the server later.
 */

export interface AttendanceContext {
  /** Today in the company timezone (follows the demo clock). */
  today: DateKey;
  /** Current demo time in epoch milliseconds. */
  nowMs: number;
  policy: AttendancePolicy;
  holidays: Record<DateKey, string>;
}

export type DayKind = "working" | "weekly_off" | "holiday";

export const attendanceId = (employeeId: string, date: DateKey) => `${employeeId}_${date}`;

export function buildHolidayMap(holidays: Holiday[]): Record<DateKey, string> {
  const map: Record<DateKey, string> = {};
  for (const holiday of holidays) map[holiday.date] = holiday.name;
  return map;
}

/* ------------------------------ calendar rules ----------------------------- */

export function getDayKind(
  date: DateKey,
  ctx: Pick<AttendanceContext, "policy" | "holidays">,
): { kind: DayKind; holidayName?: string } {
  const holidayName = ctx.holidays[date];
  if (holidayName) return { kind: "holiday", holidayName };
  if (ctx.policy.weeklyOffs.includes(getWeekday(date))) return { kind: "weekly_off" };
  return { kind: "working" };
}

export function isWorkingDay(date: DateKey, ctx: Pick<AttendanceContext, "policy" | "holidays">): boolean {
  return getDayKind(date, ctx).kind === "working";
}

export function isEmployedOn(employee: Employee, date: DateKey): boolean {
  if (date < employee.joiningDate) return false;
  if (employee.deactivatedOn && date > employee.deactivatedOn) return false;
  return true;
}

/* ---------------------------- single-record rules --------------------------- */

export function getWorkedMinutes(record: Pick<AttendanceRecord, "checkIn" | "checkOut">): number | null {
  if (!record.checkIn || !record.checkOut) return null;
  return minutesBetween(record.checkIn, record.checkOut);
}

/** Minutes since check-in for a session that is still open. */
export function getElapsedMinutes(
  record: Pick<AttendanceRecord, "checkIn" | "checkOut">,
  nowMs: number,
): number | null {
  if (!record.checkIn || record.checkOut) return null;
  return Math.max(0, Math.floor((nowMs - new Date(record.checkIn).getTime()) / 60_000));
}

export function getLateInfo(
  checkIn: IsoTimestamp | null,
  policy: AttendancePolicy,
): { isLate: boolean; minutesLate: number } {
  if (!checkIn) return { isLate: false, minutesLate: 0 };
  const minutesLate = Math.max(
    0,
    minutesOfDay(new Date(checkIn)) - parseClockTime(policy.officeStartTime),
  );
  return { isLate: minutesLate > policy.lateGraceMinutes, minutesLate };
}

/** Classifies a finished day by how long the employee worked. */
export function deriveStatusFromWorkedMinutes(
  minutes: number,
  policy: AttendancePolicy,
): Extract<RecordStatus, "present" | "half_day" | "incomplete"> {
  if (minutes >= policy.requiredWorkingHours * 60) return "present";
  if (minutes >= policy.halfDayThresholdHours * 60) return "half_day";
  return "incomplete";
}

export interface ResolvedAttendance extends AttendanceRecord {
  /**
   * Stored status, except:
   *  - an open session from a past day is reported as incomplete (no check-out was ever recorded), and
   *  - today's open session the administrator has already approved is reported as present, because
   *    they accepted the check-in. It is re-evaluated when the employee checks out.
   */
  effectiveStatus: RecordStatus;
  workedMinutes: number | null;
  lateMinutes: number;
  isLate: boolean;
  /** Checked in but not checked out. */
  isOpen: boolean;
  isToday: boolean;
}

export function resolveRecord(record: AttendanceRecord, ctx: AttendanceContext): ResolvedAttendance {
  const late = getLateInfo(record.checkIn, ctx.policy);
  return {
    ...record,
    effectiveStatus:
      record.status !== "in_progress"
        ? record.status
        : record.date < ctx.today
          ? "incomplete"
          : record.approval === "approved" && record.checkIn && !record.checkOut
            ? "present"
            : record.status,
    workedMinutes: getWorkedMinutes(record),
    lateMinutes: late.minutesLate,
    isLate: late.isLate,
    isOpen: Boolean(record.checkIn) && !record.checkOut,
    isToday: record.date === ctx.today,
  };
}

/** Plain-language reason shown for an incomplete record. */
export function describeIncomplete(record: ResolvedAttendance, policy: AttendancePolicy): string {
  if (record.isOpen) return "No check-out was recorded for this day.";
  return `Worked ${formatDuration(record.workedMinutes)}, which is below the ${policy.halfDayThresholdHours}-hour half-day threshold.`;
}

/** Latest moment anything happened to a record; used to order activity feeds. */
export function lastActivityAt(record: AttendanceRecord): string {
  return [record.checkIn, record.checkOut, record.reviewedAt]
    .filter((value): value is string => Boolean(value))
    .reduce((latest, value) => (new Date(value) > new Date(latest) ? value : latest), record.date);
}

/* --------------------------------- day entries ------------------------------- */

export interface DayEntry {
  date: DateKey;
  weekday: number;
  kind: DayKind;
  holidayName?: string;
  isToday: boolean;
  isFuture: boolean;
  /** Inside the employee's joining → deactivation window. */
  isEmployed: boolean;
  record: ResolvedAttendance | null;
  /** Value for the "attendance status" column. */
  attendanceStatus: AttendanceStatus;
  /** Value for the "approval status" column. */
  approvalStatus: ApprovalStatus;
  /** Collapsed status that drives calendar colors. */
  display: DayDisplayStatus;
  isHalfDay: boolean;
  /** A comp-off day taken by the employee: paid, and neither a holiday, a leave nor an absence. */
  compOff: boolean;
}

export function buildDayEntry(
  employee: Employee,
  date: DateKey,
  record: AttendanceRecord | undefined,
  ctx: AttendanceContext,
): DayEntry {
  // A personal week off behaves like a weekly off for this employee only.
  const personalOff = record?.status === "week_off";
  const { kind, holidayName } = personalOff ? { kind: "weekly_off" as const, holidayName: undefined } : getDayKind(date, ctx);
  const isToday = date === ctx.today;
  const isFuture = date > ctx.today;
  const isEmployed = isEmployedOn(employee, date);
  const compOff = record?.status === "comp_off";
  const resolved = record && !personalOff && !compOff ? resolveRecord(record, ctx) : null;

  let attendanceStatus: AttendanceStatus;
  let approvalStatus: ApprovalStatus = "not_required";
  let display: DayDisplayStatus;

  if (resolved) {
    attendanceStatus = resolved.effectiveStatus;
    approvalStatus = resolved.approval;
    if (resolved.approval === "rejected") display = "rejected";
    else if (resolved.effectiveStatus === "absent") display = "absent";
    else if (resolved.effectiveStatus === "in_progress") display = "in_progress";
    else if (resolved.effectiveStatus === "incomplete") display = "incomplete";
    else if (resolved.approval === "approved") display = "approved";
    else display = "pending";
  } else if (!isEmployed) {
    attendanceStatus = "not_checked_in";
    display = "inactive";
  } else if (compOff) {
    attendanceStatus = "comp_off";
    display = "comp_off";
  } else if (kind === "holiday") {
    attendanceStatus = "holiday";
    display = "holiday";
  } else if (kind === "weekly_off") {
    attendanceStatus = "weekly_off";
    display = "weekly_off";
  } else if (isFuture) {
    attendanceStatus = "not_checked_in";
    display = "upcoming";
  } else if (isToday) {
    attendanceStatus = "not_checked_in";
    display = "not_checked_in";
  } else {
    attendanceStatus = "absent";
    display = "absent";
  }

  return {
    date,
    weekday: getWeekday(date),
    kind,
    holidayName,
    isToday,
    isFuture,
    isEmployed,
    record: resolved,
    attendanceStatus,
    approvalStatus,
    display,
    isHalfDay: resolved?.effectiveStatus === "half_day",
    compOff,
  };
}

export function buildTimeline(
  employee: Employee,
  attendance: Record<string, AttendanceRecord>,
  dates: DateKey[],
  ctx: AttendanceContext,
): DayEntry[] {
  return dates.map((date) => buildDayEntry(employee, date, attendance[attendanceId(employee.id, date)], ctx));
}

export function buildMonthTimeline(
  employee: Employee,
  attendance: Record<string, AttendanceRecord>,
  year: number,
  month: number,
  ctx: AttendanceContext,
): DayEntry[] {
  return buildTimeline(employee, attendance, eachDayOfMonth(year, month), ctx);
}

/* ---------------------------------- summaries -------------------------------- */

/**
 * Every employed working day lands in exactly one bucket, so the numbers
 * always reconcile. Days that have not finished yet (today without a record,
 * future days) belong to no bucket.
 */
export interface AttendanceBuckets {
  approvedFullDays: number;
  approvedHalfDays: number;
  pendingDays: number;
  rejectedDays: number;
  incompleteDays: number;
  absentDays: number;
  /** Comp-off days taken: paid days off. */
  compOffDays: number;
  /** Comp-off earned this month by working on holidays (not paid again as work). */
  compOffEarned: number;
  /** Minutes on records that were not rejected, including a session still open today. */
  workedMinutes: number;
  lateArrivals: number;
  /** Working days with an outcome so far (everything bucketed above). */
  expectedDays: number;
}

export function bucketEntries(entries: DayEntry[], ctx: AttendanceContext): AttendanceBuckets {
  const buckets: AttendanceBuckets = {
    approvedFullDays: 0,
    approvedHalfDays: 0,
    pendingDays: 0,
    rejectedDays: 0,
    incompleteDays: 0,
    absentDays: 0,
    compOffDays: 0,
    compOffEarned: 0,
    workedMinutes: 0,
    lateArrivals: 0,
    expectedDays: 0,
  };

  for (const entry of entries) {
    const record = entry.record;
    if (entry.compOff) {
      buckets.compOffDays += 1;
      buckets.expectedDays += 1;
      continue;
    }
    if (record) {
      if (record.approval !== "rejected") {
        // Only today's open session accrues live time; older open records have no reliable duration.
        const liveMinutes = record.isOpen && record.isToday ? (getElapsedMinutes(record, ctx.nowMs) ?? 0) : 0;
        buckets.workedMinutes += record.workedMinutes ?? liveMinutes;
      }
      if (record.isLate && record.effectiveStatus !== "absent") buckets.lateArrivals += 1;

      buckets.expectedDays += 1;
      if (record.approval === "rejected") buckets.rejectedDays += 1;
      else if (record.effectiveStatus === "absent") buckets.absentDays += 1;
      else if (record.effectiveStatus === "incomplete") buckets.incompleteDays += 1;
      else if (record.effectiveStatus === "in_progress") buckets.pendingDays += 1;
      else if (record.approval === "approved") {
        if (entry.kind === "holiday") {
          // Work on a holiday is banked as comp-off instead of being paid as an extra day.
          buckets.compOffEarned += record.effectiveStatus === "half_day" ? 0.5 : 1;
        } else if (record.effectiveStatus === "half_day") buckets.approvedHalfDays += 1;
        else buckets.approvedFullDays += 1;
      } else buckets.pendingDays += 1;
    } else if (entry.kind === "working" && entry.isEmployed && entry.date < ctx.today) {
      buckets.expectedDays += 1;
      buckets.absentDays += 1;
    }
  }

  return buckets;
}

export interface MonthlyAttendanceSummary extends AttendanceBuckets {
  year: number;
  month: number;
  calendarDays: number;
  /** Working days in the month on the company calendar (weekly offs and holidays excluded). */
  scheduledWorkingDays: number;
  holidayCount: number;
  weeklyOffCount: number;
  /** Scheduled days that earn nothing: absent, rejected or incomplete. */
  unpaidDays: number;
  /** Payable attendance units counted so far using a 0.5 half day (the salary policy may differ). */
  approvedDays: number;
}

export function summarizeTimeline(
  timeline: DayEntry[],
  year: number,
  month: number,
  ctx: AttendanceContext,
): MonthlyAttendanceSummary {
  const buckets = bucketEntries(timeline, ctx);
  return {
    ...buckets,
    year,
    month,
    calendarDays: timeline.length,
    scheduledWorkingDays: timeline.filter((e) => e.kind === "working").length,
    holidayCount: timeline.filter((e) => e.kind === "holiday").length,
    weeklyOffCount: timeline.filter((e) => e.kind === "weekly_off").length,
    unpaidDays: buckets.absentDays + buckets.rejectedDays + buckets.incompleteDays,
    approvedDays: buckets.approvedFullDays + buckets.approvedHalfDays * 0.5,
  };
}

export function summarizeMonth(
  employee: Employee,
  attendance: Record<string, AttendanceRecord>,
  year: number,
  month: number,
  ctx: AttendanceContext,
): MonthlyAttendanceSummary {
  return summarizeTimeline(buildMonthTimeline(employee, attendance, year, month, ctx), year, month, ctx);
}

/* --------------------------------- today state -------------------------------- */

export type TodayState =
  | "inactive_account"
  | "non_working_day"
  | "not_checked_in"
  | "checked_in"
  | "checked_out";

export function getTodayState(employee: Employee, entry: DayEntry): TodayState {
  if (employee.status === "inactive") return "inactive_account";
  const record = entry.record;
  if (record?.checkIn) return record.checkOut ? "checked_out" : "checked_in";
  if (entry.kind !== "working") return "non_working_day";
  return "not_checked_in";
}

/** The payroll month a record belongs to. */
export function monthOfRecord(record: Pick<AttendanceRecord, "date">): { year: number; month: number } {
  const [year, month] = record.date.split("-").map(Number);
  return { year, month };
}
