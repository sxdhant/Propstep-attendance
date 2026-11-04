import {
  buildDayEntry,
  buildMonthTimeline,
  attendanceId,
  getTodayState,
  summarizeTimeline,
  type AttendanceContext,
  type DayEntry,
  type MonthlyAttendanceSummary,
  type TodayState,
} from "@/lib/attendance-utils";
import { addDays, eachDay } from "@/lib/date-utils";
import { payrollId } from "@/lib/payroll-utils";
import { buildPayrollSnapshot } from "@/lib/salary-calculator";
import { buildPayrollRow } from "@/lib/selectors/payroll";
import type { MonthRef } from "@/types/common";
import type { Database } from "@/types/database";
import type { Employee } from "@/types/employee";
import type { AppNotification } from "@/types/notification";
import type { PayrollRecord, PayrollRow, PayrollSnapshot } from "@/types/payroll";

export function findEmployee(db: Database, employeeId: string): Employee | undefined {
  return db.employees.find((employee) => employee.id === employeeId);
}

export interface EmployeeMonthView {
  employee: Employee;
  year: number;
  month: number;
  timeline: DayEntry[];
  summary: MonthlyAttendanceSummary;
  /** Live salary estimate from current attendance. */
  salary: PayrollSnapshot;
  payroll: PayrollRecord | null;
}

export function selectEmployeeMonth(
  db: Database,
  ctx: AttendanceContext,
  employeeId: string,
  year: number,
  month: number,
): EmployeeMonthView | null {
  const employee = findEmployee(db, employeeId);
  if (!employee) return null;

  const timeline = buildMonthTimeline(employee, db.attendance, year, month, ctx);
  const summary = summarizeTimeline(timeline, year, month, ctx);
  return {
    employee,
    year,
    month,
    timeline,
    summary,
    salary: buildPayrollSnapshot(employee.monthlyBasicSalary, summary, db.settings.salary),
    payroll: db.payroll[payrollId(employee.id, year, month)] ?? null,
  };
}

export interface TodayView {
  employee: Employee;
  entry: DayEntry;
  state: TodayState;
}

export function selectToday(db: Database, ctx: AttendanceContext, employeeId: string): TodayView | null {
  const employee = findEmployee(db, employeeId);
  if (!employee) return null;
  const entry = buildDayEntry(
    employee,
    ctx.today,
    db.attendance[attendanceId(employee.id, ctx.today)],
    ctx,
  );
  return { employee, entry, state: getTodayState(employee, entry) };
}

/** Payroll lines for the given months, newest first. */
export function selectPayrollHistory(
  db: Database,
  ctx: AttendanceContext,
  employeeId: string,
  months: MonthRef[],
): PayrollRow[] {
  const employee = findEmployee(db, employeeId);
  if (!employee) return [];
  return months
    .map(({ year, month }) => buildPayrollRow(db, ctx, employee, year, month))
    .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));
}

/**
 * The employee's most recent days, newest first. Days off and today-without-a-record
 * are skipped, so every row is something that actually happened.
 */
export function selectRecentEntries(
  db: Database,
  ctx: AttendanceContext,
  employeeId: string,
  spanDays = 45,
): DayEntry[] {
  const employee = findEmployee(db, employeeId);
  if (!employee) return [];
  return eachDay(addDays(ctx.today, -(spanDays - 1)), ctx.today)
    .reverse()
    .map((date) => buildDayEntry(employee, date, db.attendance[attendanceId(employee.id, date)], ctx))
    .filter((entry) => entry.isEmployed && (entry.record !== null || (entry.kind === "working" && !entry.isToday)));
}

export function selectNotifications(db: Database, recipient: string): AppNotification[] {
  return db.notifications
    .filter((notification) => notification.recipient === recipient)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The most recent paid payroll line for an employee, if any. */
export function selectLastPaid(db: Database, employeeId: string): PayrollRecord | null {
  const paid = Object.values(db.payroll)
    .filter((record) => record.employeeId === employeeId && record.status === "paid")
    .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));
  return paid[0] ?? null;
}
