import {
  attendanceId,
  buildDayEntry,
  getDayKind,
  isEmployedOn,
  lastActivityAt,
  resolveRecord,
  type AttendanceContext,
  type ResolvedAttendance,
} from "@/lib/attendance-utils";
import {
  eachDay,
  minutesOfDay,
  monthEnd,
  monthOf,
  monthStart,
  parseClockTime,
  parseDateKey,
} from "@/lib/date-utils";
import { isPayrollLocked, payrollId } from "@/lib/payroll-utils";
import { selectPayrollRows, summarizePayrollRows, type PayrollTotals } from "@/lib/selectors/payroll";
import { CHART_STATUS_ORDER, toChartStatus } from "@/lib/status-config";
import type { ChartStatus } from "@/types/attendance";
import type { DateKey, IsoTimestamp } from "@/types/common";
import type { Database } from "@/types/database";
import type { Employee } from "@/types/employee";

export type StatusCounts = Record<ChartStatus, number>;

export const emptyStatusCounts = (): StatusCounts => ({
  approved: 0,
  absent: 0,
  pending: 0,
  rejected: 0,
  incomplete: 0,
});

export interface TrendPoint extends StatusCounts {
  date: DateKey;
  /** Day of the month, used as the axis label. */
  label: string;
  total: number;
}

/** Headcount by status for every day that produced an outcome. */
export function buildAttendanceTrend(
  employees: Employee[],
  db: Database,
  ctx: AttendanceContext,
  dates: DateKey[],
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const date of dates) {
    const counts = emptyStatusCounts();
    let total = 0;
    for (const employee of employees) {
      const entry = buildDayEntry(employee, date, db.attendance[attendanceId(employee.id, date)], ctx);
      const status = toChartStatus(entry.display);
      if (status) {
        counts[status] += 1;
        total += 1;
      }
    }
    if (total > 0) {
      points.push({ ...counts, date, label: String(parseDateKey(date).day), total });
    }
  }
  return points;
}

export interface ActivityRow {
  employee: Employee;
  record: ResolvedAttendance;
  at: IsoTimestamp;
}

export interface AdminOverview {
  activeEmployees: number;
  inactiveEmployees: number;
  isWorkingDayToday: boolean;
  holidayToday?: string;
  expectedToday: number;
  /** Checked in AND approved by an administrator. */
  presentToday: number;
  /** Checked in, but still waiting for an administrator's decision. */
  awaitingApprovalToday: number;
  checkedOutToday: number;
  absentToday: number;
  /** Local time after which a missing check-in counts as absent. */
  absentCutoff: string;
  pendingApprovals: number;
  incompleteAttendance: number;
  payroll: PayrollTotals;
  trend: TrendPoint[];
  distribution: Array<{ status: ChartStatus; count: number }>;
  recentActivity: ActivityRow[];
}

export function selectPendingCount(db: Database): number {
  let count = 0;
  for (const record of Object.values(db.attendance)) if (record.approval === "pending") count += 1;
  return count;
}

export function selectAdminOverview(db: Database, ctx: AttendanceContext, activityLimit = 8): AdminOverview {
  const current = monthOf(ctx.today);
  const active = db.employees.filter((employee) => employee.status === "active");
  const todayKind = getDayKind(ctx.today, ctx);
  const isWorkingDayToday = todayKind.kind === "working";

  const expected = isWorkingDayToday ? active.filter((employee) => isEmployedOn(employee, ctx.today)) : [];
  const todayRecords = expected.map((employee) => db.attendance[attendanceId(employee.id, ctx.today)]);
  const checkedOutToday = todayRecords.filter((record) => record?.checkOut).length;

  // The cards and the lists behind them come from one place, so a number never disagrees with its list.
  const roster = selectTodayRoster(db, ctx);
  const presentToday = roster.present.length;
  const awaitingApprovalToday = roster.awaiting.length;
  const absentToday = roster.absent.length;

  let incompleteAttendance = 0;
  for (const record of Object.values(db.attendance)) {
    if (record.approval === "pending" && resolveRecord(record, ctx).effectiveStatus === "incomplete") {
      incompleteAttendance += 1;
    }
  }

  const monthDates = eachDay(
    monthStart(current.year, current.month),
    ctx.today < monthEnd(current.year, current.month) ? ctx.today : monthEnd(current.year, current.month),
  );
  const trend = buildAttendanceTrend(db.employees, db, ctx, monthDates);
  const distribution = CHART_STATUS_ORDER.map((status) => ({
    status,
    count: trend.reduce((sum, point) => sum + point[status], 0),
  }));

  const employeesById = new Map(db.employees.map((employee) => [employee.id, employee]));
  const recentActivity: ActivityRow[] = Object.values(db.attendance)
    .filter((record) => record.checkIn)
    .map((record) => ({ record, at: lastActivityAt(record) }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, activityLimit)
    .flatMap(({ record, at }) => {
      const employee = employeesById.get(record.employeeId);
      return employee ? [{ employee, record: resolveRecord(record, ctx), at }] : [];
    });

  return {
    activeEmployees: active.length,
    inactiveEmployees: db.employees.length - active.length,
    isWorkingDayToday,
    holidayToday: todayKind.holidayName,
    expectedToday: expected.length,
    presentToday,
    awaitingApprovalToday,
    checkedOutToday,
    absentToday,
    absentCutoff: ctx.policy.officeStartTime,
    pendingApprovals: selectPendingCount(db),
    incompleteAttendance,
    payroll: summarizePayrollRows(selectPayrollRows(db, ctx, current.year, current.month)),
    trend,
    distribution,
    recentActivity,
  };
}

export interface ApprovalRow {
  employee: Employee;
  record: ResolvedAttendance;
  /** Payroll for this month is finalized, so the decision can no longer be changed. */
  locked: boolean;
}

/** Every attendance request (a record with a decision to make or already made) in a month. */
export function selectApprovalRows(
  db: Database,
  ctx: AttendanceContext,
  year: number,
  month: number,
): ApprovalRow[] {
  const start = monthStart(year, month);
  const end = monthEnd(year, month);
  const employeesById = new Map(db.employees.map((employee) => [employee.id, employee]));

  const rows: ApprovalRow[] = [];
  for (const record of Object.values(db.attendance)) {
    if (record.approval === "not_required" || record.date < start || record.date > end) continue;
    const employee = employeesById.get(record.employeeId);
    if (!employee) continue;
    rows.push({
      employee,
      record: resolveRecord(record, ctx),
      locked: isPayrollLocked(db.payroll[payrollId(employee.id, year, month)]),
    });
  }

  return rows.sort(
    (a, b) =>
      b.record.date.localeCompare(a.record.date) || a.employee.fullName.localeCompare(b.employee.fullName),
  );
}

/* ------------------------------ today's roster ------------------------------ */

export type RosterState =
  /** Checked in today and approved by an administrator. */
  | "present"
  /** Checked in today, waiting for an administrator's decision. Not yet counted as present. */
  | "awaiting"
  /** Expected today, and either marked absent or past the grace cutoff without a check-in. */
  | "absent"
  /** Expected today, but it is still early enough that a check-in may come. */
  | "not_arrived"
  /** Not expected today: weekly off, holiday, or not employed yet. */
  | "not_expected";

export interface RosterRow {
  employee: Employee;
  /** Today's record, if any. */
  record: ResolvedAttendance | null;
  state: RosterState;
  /** Why someone is "not_expected" (for example "Weekly off" or "Joins 12 Nov"). */
  reason?: string;
}

export interface TodayRoster {
  /** Every active employee. */
  all: RosterRow[];
  /** Approved check-ins, earliest first. Its length is the "Present Today" card value. */
  present: RosterRow[];
  /** Check-ins waiting for approval, earliest first. */
  awaiting: RosterRow[];
  /** Its length is the "Absent Today" card value. */
  absent: RosterRow[];
  absentCutoff: string;
  /** False on a weekly off or holiday, when nobody is expected. */
  isWorkingDayToday: boolean;
  /** Why nobody is expected today ("Weekly off", or the holiday's name). */
  nonWorkingReason?: string;
}

/**
 * Who is in, who is out and who is late today, using exactly the rules behind
 * the dashboard cards so a list never disagrees with the number above it.
 */
export function selectTodayRoster(db: Database, ctx: AttendanceContext): TodayRoster {
  const todayKind = getDayKind(ctx.today, ctx);
  const isWorkingDayToday = todayKind.kind === "working";
  const cutoffMinutes = parseClockTime(ctx.policy.officeStartTime) + ctx.policy.lateGraceMinutes;
  const afterCutoff = minutesOfDay(new Date(ctx.nowMs)) >= cutoffMinutes;

  const rows: RosterRow[] = db.employees
    .filter((employee) => employee.status === "active")
    .map((employee): RosterRow => {
      const raw = db.attendance[attendanceId(employee.id, ctx.today)];
      const record = raw ? resolveRecord(raw, ctx) : null;
      const employed = isEmployedOn(employee, ctx.today);

      if (!isWorkingDayToday || !employed) {
        const reason = !employed
          ? `Joins ${employee.joiningDate}`
          : (todayKind.holidayName ?? "Weekly off");
        return { employee, record, state: "not_expected", reason };
      }
      if (raw?.checkIn) {
        if (raw.approval === "rejected") return { employee, record, state: "absent", reason: "Check-in rejected" };
        if (raw.approval === "pending") return { employee, record, state: "awaiting" };
        return { employee, record, state: "present" };
      }
      if (raw || afterCutoff) return { employee, record, state: "absent" };
      return { employee, record, state: "not_arrived" };
    })
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName));

  return {
    all: rows,
    present: rows
      .filter((row) => row.state === "present")
      .sort((a, b) => (a.record?.checkIn ?? "").localeCompare(b.record?.checkIn ?? "")),
    awaiting: rows
      .filter((row) => row.state === "awaiting")
      .sort((a, b) => (a.record?.checkIn ?? "").localeCompare(b.record?.checkIn ?? "")),
    absent: rows.filter((row) => row.state === "absent"),
    absentCutoff: ctx.policy.officeStartTime,
    isWorkingDayToday,
    nonWorkingReason: isWorkingDayToday ? undefined : (todayKind.holidayName ?? "Weekly off"),
  };
}
