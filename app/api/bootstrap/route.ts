import { avatarUrl } from "@/lib/server/avatars";
import { monthStart, shiftMonth, monthOf, toDateKey, toIstTimestamp } from "@/lib/date-utils";
import { DB_VERSION } from "@/lib/constants";
import { query } from "@/lib/server/db";
import { failure, requireUser, success } from "@/lib/server/http";
import {
  EMPLOYEE_COLUMNS,
  loadHolidayMap,
  loadSettings,
  toAttendance,
  toEmployee,
  toNotification,
  type AttendanceRow,
} from "@/lib/server/repo";
import { SEEDED_HISTORY_MONTHS } from "@/lib/selectors/context";
import type { Database } from "@/types/database";
import type { PayrollRecord } from "@/types/payroll";

/** Months of history the app can browse, ending today. */
const HISTORY_MONTHS = 12;

/**
 * One snapshot of everything the signed-in user may see, in the exact shape
 * the UI's selectors already consume. Admins get the whole company;
 * employees get only their own records.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const isAdmin = user.role === "admin";

  const now = new Date();
  const today = toDateKey(now);
  // The UI computes its earliest month as (month of seededAt) - SEEDED_HISTORY_MONTHS.
  const anchor = shiftMonth(monthOf(today), -(HISTORY_MONTHS - SEEDED_HISTORY_MONTHS));
  const windowStart = monthStart(shiftMonth(anchor, -SEEDED_HISTORY_MONTHS).year, shiftMonth(anchor, -SEEDED_HISTORY_MONTHS).month);
  const seededAt = toIstTimestamp(new Date(`${monthStart(anchor.year, anchor.month)}T00:00:00+05:30`));

  const scope = isAdmin ? null : user.refId;
  const [settings, holidayMap, employeeRows, adminRows, attendanceRows, payrollRows, notificationRows, photoRows] = await Promise.all([
    loadSettings(),
    loadHolidayMap(),
    query(`SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE ($1::text IS NULL OR id = $1) ORDER BY full_name`, [scope]),
    isAdmin ? query("SELECT id, full_name, email, title, phone FROM admins ORDER BY id") : Promise.resolve([]),
    query<AttendanceRow>(
      "SELECT * FROM attendance WHERE date >= $1 AND ($2::text IS NULL OR employee_id = $2) ORDER BY date DESC",
      [windowStart, scope],
    ),
    query<{ data: PayrollRecord }>("SELECT data FROM payroll WHERE ($1::text IS NULL OR employee_id = $1)", [scope]),
    query(
      "SELECT * FROM notifications WHERE recipient = $1 ORDER BY created_at DESC LIMIT 300",
      [isAdmin ? "admin" : user.refId],
    ),
    query<{ owner_id: string; v: string }>(
      "SELECT owner_id, (extract(epoch from updated_at) * 1000)::bigint::text AS v FROM avatars WHERE ($1::text IS NULL OR owner_id = $1)",
      [scope],
    ),
  ]);
  const photos = new Map(photoRows.map((r) => [r.owner_id, avatarUrl(r.owner_id, r.v)]));

  const employees = employeeRows.map((row) => {
    const e = toEmployee(row as never);
    const photoUrl = photos.get(e.id);
    return photoUrl ? { ...e, photoUrl } : e;
  });
  if (!isAdmin && employees.length === 0) return failure("Your employee record was not found.", 404);

  const db: Database = {
    version: DB_VERSION,
    seededAt,
    clockOffsetMs: 0,
    settings,
    // Employees never receive administrator identities; the UI just needs a non-empty list.
    admins: isAdmin
      ? adminRows.map((a) => ({ id: String(a.id), fullName: String(a.full_name), email: String(a.email), title: String(a.title), phone: String(a.phone ?? ""), ...(photos.get(String(a.id)) ? { photoUrl: photos.get(String(a.id)) } : {}) }))
      : [{ id: "ADM", fullName: "Administrator", email: "", title: "Administrator" }],
    employees,
    attendance: Object.fromEntries(attendanceRows.map((row) => [row.id, toAttendance(row)])),
    payroll: Object.fromEntries(payrollRows.map((row) => [row.data.id, row.data])),
    notifications: notificationRows.map((row) => toNotification(row as never)),
    holidays: Object.entries(holidayMap)
      .map(([date, name]) => ({ date, name }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
  return success({ db, serverNow: now.getTime() });
}
