import { attendanceId, getDayKind } from "@/lib/attendance-utils";
import { toDateKey, toIstTimestamp } from "@/lib/date-utils";
import { formatTime } from "@/lib/format";
import { transaction, queryOne } from "@/lib/server/db";
import { csrfGuard, failure, requireUser, success } from "@/lib/server/http";
import {
  addNotification,
  findEmployee,
  isMonthLocked,
  loadHolidayMap,
  loadSettings,
  toAttendance,
  type AttendanceRow,
} from "@/lib/server/repo";

/** Employee check-in. The time always comes from the server clock, never from the client. */
export async function POST() {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("employee");
  if ("response" in auth) return auth.response;

  return transaction(async (tx) => {
    const employee = await findEmployee(auth.user.refId, tx, true);
    if (!employee) return failure("Employee not found.", 404);
    if (employee.status !== "active") return failure("This account is deactivated, so check-in is unavailable.", 403);

    const now = new Date();
    const today = toDateKey(now);
    const day = getDayKind(today, { policy: (await loadSettings(tx)).attendance, holidays: await loadHolidayMap(tx) });
    if (day.kind === "holiday") return failure(`Today is a company holiday (${day.holidayName}).`, 409);
    if (day.kind === "weekly_off") return failure("Today is a weekly off. Check-in is only available on working days.", 409);
    if (today < employee.joiningDate) return failure("Check-in opens on your joining date.", 409);
    if (await isMonthLocked(tx, employee.id, today)) return failure("Payroll for this month is finalized.", 409);

    // Atomic: only the first check-in of the day can win, even with concurrent requests.
    const row = await queryOne<AttendanceRow>(
      `INSERT INTO attendance (id, employee_id, date, check_in, status, approval)
       VALUES ($1,$2,$3,$4,'in_progress','pending')
       ON CONFLICT (id) DO UPDATE SET check_in = EXCLUDED.check_in, status = 'in_progress', approval = 'pending'
         WHERE attendance.check_in IS NULL
       RETURNING *`,
      [attendanceId(employee.id, today), employee.id, today, now],
      tx,
    );
    if (!row) return failure("You've already checked in today.", 409);

    // Tell the administrators straight away; the day sits as Pending until one of them decides.
    await addNotification(tx, {
      recipient: "admin",
      type: "attendance_submitted",
      title: "Employee checked in",
      message: `${employee.fullName} checked in at ${formatTime(toIstTimestamp(now))}. It is pending your approval.`,
      href: "/admin/attendance",
    });
    return success(toAttendance(row), 201);
  });
}
