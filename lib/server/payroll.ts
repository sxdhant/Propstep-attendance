import "server-only";
import { summarizeMonth, type AttendanceContext } from "@/lib/attendance-utils";
import { monthEnd, monthStart, toDateKey } from "@/lib/date-utils";
import { query, type Queryable } from "@/lib/server/db";
import {
  EMPLOYEE_COLUMNS,
  loadHolidayMap,
  loadSettings,
  toAttendance,
  toEmployee,
  type AttendanceRow,
} from "@/lib/server/repo";
import { isEmployeeInPayrollMonth, isPayrollLocked, payrollId } from "@/lib/payroll-utils";
import { buildPayrollSnapshot } from "@/lib/salary-calculator";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { PayrollRecord, PayrollRow } from "@/types/payroll";
import type { AppSettings } from "@/types/settings";

/** Server-side payroll: the same pure salary rules the frontend uses, fed from Postgres. */

export interface MonthData {
  settings: AppSettings;
  ctx: AttendanceContext;
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  records: Record<string, PayrollRecord>;
}

export async function loadMonthData(db: Queryable, year: number, month: number, employeeId?: string): Promise<MonthData> {
  const settings = await loadSettings(db);
  const holidays = await loadHolidayMap(db);
  const now = new Date();
  const ctx: AttendanceContext = { today: toDateKey(now), nowMs: now.getTime(), policy: settings.attendance, holidays };

  const who = employeeId ? [employeeId] : null;
  const employees = (
    await query(`SELECT ${EMPLOYEE_COLUMNS} FROM employees ${who ? "WHERE id = $1" : ""} ORDER BY full_name`, who ?? [], db)
  )
    .map((row) => toEmployee(row as never))
    .filter((e) => isEmployeeInPayrollMonth(e, year, month));

  const ids = employees.map((e) => e.id);
  const attendance: Record<string, AttendanceRecord> = {};
  if (ids.length) {
    const rows = await query<AttendanceRow>(
      "SELECT * FROM attendance WHERE employee_id = ANY($1) AND date >= $2 AND date <= $3",
      [ids, monthStart(year, month), monthEnd(year, month)],
      db,
    );
    for (const row of rows) attendance[row.id] = toAttendance(row);
  }

  const records: Record<string, PayrollRecord> = {};
  if (ids.length) {
    const rows = await query<{ data: PayrollRecord }>("SELECT data FROM payroll WHERE employee_id = ANY($1) AND id LIKE $2", [
      ids,
      `%\\_${year}-${String(month).padStart(2, "0")}`,
    ], db);
    for (const row of rows) records[row.data.id] = row.data;
  }
  return { settings, ctx, employees, attendance, records };
}

/** One payroll line: frozen snapshot once finalized/paid, otherwise live from current attendance. */
export function buildRow(data: MonthData, employee: Employee, year: number, month: number): PayrollRow {
  const record = data.records[payrollId(employee.id, year, month)] ?? null;
  if (record && isPayrollLocked(record) && record.snapshot) {
    return { employee, year, month, status: record.status, record, figures: record.snapshot, isLive: false };
  }
  const summary = summarizeMonth(employee, data.attendance, year, month, data.ctx);
  return {
    employee,
    year,
    month,
    status: record ? record.status : "not_generated",
    record,
    figures: buildPayrollSnapshot(employee.monthlyBasicSalary, summary, data.settings.salary),
    isLive: true,
  };
}

export async function savePayroll(db: Queryable, record: PayrollRecord) {
  await query(
    `INSERT INTO payroll (id, employee_id, data) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [record.id, record.employeeId, JSON.stringify(record)],
    db,
  );
}

/** Locks a month's payroll rows so concurrent finalize / pay / attendance changes serialize. */
export async function lockPayroll(db: Queryable, year: number, month: number, employeeId?: string): Promise<void> {
  await query(
    "SELECT id FROM payroll WHERE id LIKE $1 AND ($2::text IS NULL OR employee_id = $2) FOR UPDATE",
    [`%\\_${year}-${String(month).padStart(2, "0")}`, employeeId ?? null],
    db,
  );
}
