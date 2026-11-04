import { attendanceId, deriveStatusFromWorkedMinutes } from "@/lib/attendance-utils";
import { toDateKey } from "@/lib/date-utils";
import { formatDuration } from "@/lib/format";
import { queryOne, transaction } from "@/lib/server/db";
import { csrfGuard, failure, requireUser, success } from "@/lib/server/http";
import { addNotification, findEmployee, loadSettings, toAttendance, type AttendanceRow } from "@/lib/server/repo";

export async function POST() {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("employee");
  if ("response" in auth) return auth.response;

  return transaction(async (tx) => {
    const employee = await findEmployee(auth.user.refId, tx);
    if (!employee) return failure("Employee not found.", 404);

    const now = new Date();
    const current = await queryOne<AttendanceRow>(
      "SELECT * FROM attendance WHERE id = $1 FOR UPDATE",
      [attendanceId(employee.id, toDateKey(now))],
      tx,
    );
    if (!current?.check_in) return failure("You haven't checked in today.", 409);
    if (current.check_out) return failure("You've already checked out today.", 409);

    const worked = Math.max(0, Math.round((now.getTime() - current.check_in.getTime()) / 60_000));
    const status = deriveStatusFromWorkedMinutes(worked, (await loadSettings(tx)).attendance);
    // An administrator may already have approved this check-in. That approval stands unless the day
    // turns out too short to count (under the half-day threshold), which needs a fresh decision.
    const wasApproved = current.approval === "approved";
    const needsReviewAgain = wasApproved && status === "incomplete";
    const updated = await queryOne<AttendanceRow>(
      `UPDATE attendance SET check_out = $1, status = $2,
         approval = CASE WHEN $4 THEN 'pending' ELSE approval END,
         reviewed_at = CASE WHEN $4 THEN NULL ELSE reviewed_at END,
         reviewed_by = CASE WHEN $4 THEN NULL ELSE reviewed_by END
       WHERE id = $3 RETURNING *`,
      [now, status, current.id, needsReviewAgain],
      tx,
    );

    if (!wasApproved) {
      await addNotification(tx, {
        recipient: "admin",
        type: "attendance_submitted",
        title: "Attendance waiting for review",
        message: `${employee.fullName} checked out after ${formatDuration(worked)}. Review and approve the day.`,
        href: "/admin/attendance",
      });
    } else if (needsReviewAgain) {
      await addNotification(tx, {
        recipient: "admin",
        type: "attendance_submitted",
        title: "Approved check-in needs another look",
        message: `${employee.fullName} checked out after only ${formatDuration(worked)}, below the half-day threshold, so the day is Pending again.`,
        href: "/admin/attendance",
      });
    } else if (status === "half_day") {
      await addNotification(tx, {
        recipient: "admin",
        type: "attendance_submitted",
        title: "Approved day recorded as a half day",
        message: `${employee.fullName} checked out after ${formatDuration(worked)}, so the approved day counts as a Half Day.`,
        href: "/admin/attendance",
      });
    }
    return success(toAttendance(updated as AttendanceRow));
  });
}
