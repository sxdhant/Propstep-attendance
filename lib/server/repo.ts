import "server-only";
import { toIstTimestamp } from "@/lib/date-utils";
import { query, queryOne, type Queryable } from "@/lib/server/db";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { AppNotification } from "@/types/notification";
import type { AppSettings } from "@/types/settings";

/** Row <-> domain-type mapping, so routes work with the same types as the frontend. */

interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joining_date: string;
  monthly_basic_salary: number;
  status: Employee["status"];
  deactivated_on: string | null;
  profile: Employee["profile"] | null;
}

export interface AttendanceRow {
  id: string;
  employee_id: string;
  date: string;
  check_in: Date | null;
  check_out: Date | null;
  status: AttendanceRecord["status"];
  approval: AttendanceRecord["approval"];
  remarks: string | null;
  rejection_reason: string | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  review_note: string | null;
}

interface NotificationRow {
  id: string;
  recipient: string;
  type: AppNotification["type"];
  title: string;
  message: string;
  created_at: Date;
  read: boolean;
  href: string | null;
}

export const EMPLOYEE_COLUMNS =
  "id, full_name, email, phone, department, designation, joining_date, monthly_basic_salary, status, deactivated_on, profile";

export function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    designation: row.designation,
    joiningDate: row.joining_date,
    monthlyBasicSalary: row.monthly_basic_salary,
    status: row.status,
    ...(row.deactivated_on ? { deactivatedOn: row.deactivated_on } : {}),
    ...(row.profile ? { profile: row.profile } : {}),
  };
}

const ist = (value: Date | null) => (value ? toIstTimestamp(value) : null);

export function toAttendance(row: AttendanceRow): AttendanceRecord {
  const record: AttendanceRecord = {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    checkIn: ist(row.check_in),
    checkOut: ist(row.check_out),
    status: row.status,
    approval: row.approval,
  };
  if (row.remarks) record.remarks = row.remarks;
  if (row.rejection_reason) record.rejectionReason = row.rejection_reason;
  if (row.reviewed_at) record.reviewedAt = ist(row.reviewed_at) as string;
  if (row.reviewed_by) record.reviewedBy = row.reviewed_by;
  if (row.review_note) record.reviewNote = row.review_note;
  return record;
}

export function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    recipient: row.recipient,
    type: row.type,
    title: row.title,
    message: row.message,
    createdAt: toIstTimestamp(row.created_at),
    read: row.read,
    ...(row.href ? { href: row.href } : {}),
  };
}

export async function loadSettings(db?: Queryable): Promise<AppSettings> {
  const row = await queryOne<{ value: AppSettings }>("SELECT value FROM settings WHERE key = 'app'", [], db);
  if (!row) throw new Error("Settings are missing. Run the database seed.");
  return row.value;
}

export async function loadHolidayMap(db?: Queryable): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const row of await query<{ date: string; name: string }>("SELECT date, name FROM holidays", [], db)) {
    map[row.date] = row.name;
  }
  return map;
}

export async function findEmployee(id: string, db?: Queryable, lock = false): Promise<Employee | null> {
  const row = await queryOne<EmployeeRow>(
    `SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [id],
    db,
  );
  return row ? toEmployee(row) : null;
}

export async function addNotification(
  db: Queryable,
  n: Omit<AppNotification, "id" | "createdAt" | "read">,
) {
  await query(
    "INSERT INTO notifications (id, recipient, type, title, message, href) VALUES ($1,$2,$3,$4,$5,$6)",
    [`ntf_${crypto.randomUUID()}`, n.recipient, n.type, n.title, n.message, n.href ?? null],
    db,
  );
}

/**
 * Finalized and paid payroll freezes the month's attendance. The row is read
 * FOR SHARE, so an attendance change waits for an in-flight finalization (which
 * takes the row FOR UPDATE) instead of slipping in after the snapshot was taken.
 */
export async function isMonthLocked(db: Queryable, employeeId: string, date: string): Promise<boolean> {
  const row = await queryOne<{ status: string }>("SELECT data->>'status' AS status FROM payroll WHERE id = $1 FOR SHARE", [
    `${employeeId}_${date.slice(0, 7)}`,
  ], db);
  return row?.status === "finalized" || row?.status === "paid";
}
