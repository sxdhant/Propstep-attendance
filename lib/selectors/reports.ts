import { buildDayEntry, attendanceId, type AttendanceContext, type DayEntry } from "@/lib/attendance-utils";
import { compareMonths, eachDay, eachMonth, monthOf, parseDateKey } from "@/lib/date-utils";
import { formatDate, formatMonthYearShort } from "@/lib/format";
import { selectPayrollRows } from "@/lib/selectors/payroll";
import { emptyStatusCounts, type StatusCounts } from "@/lib/selectors/admin";
import { toChartStatus } from "@/lib/status-config";
import type { DateKey } from "@/types/common";
import type { Database } from "@/types/database";
import type { Employee } from "@/types/employee";
import type { PayrollRow, PayrollStatus } from "@/types/payroll";

export type ReportAttendanceFilter =
  | "all"
  | "approved"
  | "pending"
  | "rejected"
  | "absent"
  | "incomplete"
  | "half_day"
  | "holiday"
  | "weekly_off";

export type ReportPayrollFilter = PayrollStatus | "not_generated" | "all";

export interface ReportFilters {
  start: DateKey;
  end: DateKey;
  /** Employee id or `all`. */
  employeeId: string;
  /** Department name or `all`. */
  department: string;
  attendanceStatus: ReportAttendanceFilter;
  payrollStatus: ReportPayrollFilter;
}

export interface ReportRow {
  employee: Employee;
  entry: DayEntry;
}

export interface EmployeeBreakdown extends StatusCounts {
  employee: Employee;
  halfDays: number;
  minutes: number;
  lateArrivals: number;
  /** Share of recorded days that were not absent, rejected or incomplete. */
  attendanceRate: number;
}

export interface TrendBucket extends StatusCounts {
  key: string;
  label: string;
}

export interface PayrollMonthTotals {
  key: string;
  label: string;
  year: number;
  month: number;
  not_generated: number;
  draft: number;
  finalized: number;
  paid: number;
}

export interface ReportSummary extends StatusCounts {
  totalRecords: number;
  halfDays: number;
  totalMinutes: number;
  averageMinutesPerRecord: number;
  lateArrivals: number;
  absentEmployeeDays: number;
}

export interface ReportData {
  employees: Employee[];
  rows: ReportRow[];
  summary: ReportSummary;
  granularity: "day" | "month";
  trend: TrendBucket[];
  byEmployee: EmployeeBreakdown[];
  payrollRows: PayrollRow[];
  payrollByMonth: PayrollMonthTotals[];
}

const NON_WORKING_OR_FUTURE = new Set(["holiday", "weekly_off", "upcoming", "inactive", "not_checked_in"]);
const DAILY_GRANULARITY_MAX_DAYS = 45;

function matchesAttendanceFilter(entry: DayEntry, filter: ReportAttendanceFilter): boolean {
  switch (filter) {
    case "all":
      return !NON_WORKING_OR_FUTURE.has(entry.display);
    case "half_day":
      return entry.isHalfDay;
    case "pending":
      return entry.display === "pending" || entry.display === "in_progress";
    default:
      return entry.display === filter;
  }
}

export function selectReport(db: Database, ctx: AttendanceContext, filters: ReportFilters): ReportData {
  const employees = db.employees.filter(
    (employee) =>
      (filters.employeeId === "all" || employee.id === filters.employeeId) &&
      (filters.department === "all" || employee.department === filters.department),
  );

  const lastDay = filters.end < ctx.today ? filters.end : ctx.today;
  const dates = filters.start <= lastDay ? eachDay(filters.start, lastDay) : [];

  const rows: ReportRow[] = [];
  for (const employee of employees) {
    for (const date of dates) {
      const entry = buildDayEntry(employee, date, db.attendance[attendanceId(employee.id, date)], ctx);
      if (!entry.isEmployed && !entry.record) continue;
      if (matchesAttendanceFilter(entry, filters.attendanceStatus)) rows.push({ employee, entry });
    }
  }

  /* ---- summary, trend and per-employee breakdown, all from the same rows ---- */
  const summary: ReportSummary = {
    ...emptyStatusCounts(),
    totalRecords: 0,
    halfDays: 0,
    totalMinutes: 0,
    averageMinutesPerRecord: 0,
    lateArrivals: 0,
    absentEmployeeDays: 0,
  };

  const granularity = dates.length <= DAILY_GRANULARITY_MAX_DAYS ? "day" : "month";
  const trendMap = new Map<string, TrendBucket>();
  const breakdownMap = new Map<string, EmployeeBreakdown>();
  let workedRecords = 0;

  for (const { employee, entry } of rows) {
    const status = toChartStatus(entry.display);
    const minutes = entry.record && entry.record.approval !== "rejected" ? (entry.record.workedMinutes ?? 0) : 0;

    if (status) {
      summary[status] += 1;
      summary.totalRecords += 1;
    }
    if (entry.isHalfDay) summary.halfDays += 1;
    if (entry.record?.isLate) summary.lateArrivals += 1;
    summary.totalMinutes += minutes;
    if (minutes > 0) workedRecords += 1;

    let breakdown = breakdownMap.get(employee.id);
    if (!breakdown) {
      breakdown = {
        ...emptyStatusCounts(),
        employee,
        halfDays: 0,
        minutes: 0,
        lateArrivals: 0,
        attendanceRate: 0,
      };
      breakdownMap.set(employee.id, breakdown);
    }
    if (status) breakdown[status] += 1;
    if (entry.isHalfDay) breakdown.halfDays += 1;
    if (entry.record?.isLate) breakdown.lateArrivals += 1;
    breakdown.minutes += minutes;

    if (status) {
      const { year, month } = parseDateKey(entry.date);
      const key = granularity === "day" ? entry.date : `${year}-${String(month).padStart(2, "0")}`;
      let bucket = trendMap.get(key);
      if (!bucket) {
        bucket = {
          ...emptyStatusCounts(),
          key,
          label: granularity === "day" ? formatDate(entry.date, "short") : formatMonthYearShort(year, month),
        };
        trendMap.set(key, bucket);
      }
      bucket[status] += 1;
    }
  }

  summary.absentEmployeeDays = summary.absent;
  summary.averageMinutesPerRecord = workedRecords ? summary.totalMinutes / workedRecords : 0;

  const trend = [...trendMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const byEmployee = [...breakdownMap.values()]
    .map((item) => {
      const total = item.approved + item.pending + item.rejected + item.absent + item.incomplete;
      return { ...item, attendanceRate: total ? ((item.approved + item.pending) / total) * 100 : 0 };
    })
    .sort((a, b) => a.employee.id.localeCompare(b.employee.id));

  /* ---- payroll for every month the range touches ---- */
  const currentMonth = monthOf(ctx.today);
  const firstMonth = monthOf(filters.start);
  const lastMonthRaw = monthOf(filters.end);
  const lastMonth = compareMonths(lastMonthRaw, currentMonth) > 0 ? currentMonth : lastMonthRaw;
  const employeeIds = new Set(employees.map((employee) => employee.id));

  const payrollRows: PayrollRow[] = [];
  const payrollByMonth: PayrollMonthTotals[] = [];
  for (const { year, month } of eachMonth(firstMonth, lastMonth)) {
    const totals: PayrollMonthTotals = {
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: formatMonthYearShort(year, month),
      year,
      month,
      not_generated: 0,
      draft: 0,
      finalized: 0,
      paid: 0,
    };
    for (const row of selectPayrollRows(db, ctx, year, month)) {
      if (!employeeIds.has(row.employee.id)) continue;
      if (filters.payrollStatus !== "all" && row.status !== filters.payrollStatus) continue;
      payrollRows.push(row);
      totals[row.status] += row.figures.estimatedSalary;
    }
    payrollByMonth.push(totals);
  }
  payrollRows.sort(
    (a, b) =>
      b.year * 12 + b.month - (a.year * 12 + a.month) || a.employee.id.localeCompare(b.employee.id),
  );

  return { employees, rows, summary, granularity, trend, byEmployee, payrollRows, payrollByMonth };
}
