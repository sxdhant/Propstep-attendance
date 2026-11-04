import { z } from "zod";
import { toDateKey } from "@/lib/date-utils";
import { formatDate } from "@/lib/format";
import { audit } from "@/lib/server/audit";
import { queryOne, transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { addNotification, isMonthLocked, toAttendance, type AttendanceRow } from "@/lib/server/repo";

const body = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), payableAs: z.enum(["full", "half"]).optional() }),
  z.object({ decision: z.literal("reject"), reason: z.string().trim().min(5, "Enter a reason of at least 5 characters.").max(500) }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/attendance/[id]/review">) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid request.");
  const input = parsed.data;
  const { id } = await ctx.params;

  const result = await transaction(async (tx) => {
    const current = await queryOne<AttendanceRow>("SELECT * FROM attendance WHERE id = $1 FOR UPDATE", [id], tx);
    if (!current) return failure("That attendance record no longer exists.", 404);
    if (current.approval === "not_required") return failure("This day doesn't need an approval.", 409);
    if (await isMonthLocked(tx, current.employee_id, current.date)) {
      return failure("Payroll for that month is finalized, so attendance can't be changed.", 409);
    }

    const today = toDateKey(new Date());
    const dayLabel = formatDate(current.date);
    let updated: AttendanceRow | null;
    let notice: { type: "attendance_approved" | "attendance_rejected"; title: string; message: string };

    if (input.decision === "approve") {
      if (current.approval === "approved") return failure("This day is already approved.", 409);
      // Approving while the employee is still checked in is allowed: it accepts the check-in and the day
      // reads as Present. The hours are checked again at check-out.
      const stillIn = Boolean(current.check_in) && !current.check_out;
      const incomplete = current.status === "incomplete" || (current.status === "in_progress" && current.date < today);
      let status = current.status;
      let reviewNote: string | null = null;
      if (incomplete) {
        if (!input.payableAs) return failure("Choose how this incomplete day should be counted.");
        status = input.payableAs === "half" ? "half_day" : "present";
        reviewNote = `Regularized by an administrator and counted as a ${input.payableAs} day.`;
      }
      updated = await queryOne<AttendanceRow>(
        `UPDATE attendance SET status=$1, approval='approved', reviewed_at=now(), reviewed_by=$2, review_note=$3, rejection_reason=NULL
         WHERE id=$4 RETURNING *`,
        [status, auth.user.refId, reviewNote, id],
        tx,
      );
      notice = {
        type: "attendance_approved",
        title: stillIn ? "Check-in approved" : "Attendance approved",
        message: stillIn
          ? `Your check-in for ${dayLabel} was approved. You're marked Present; your hours are checked when you check out.`
          : `Your attendance for ${dayLabel} was approved.`,
      };
    } else {
      if (current.approval === "rejected") return failure("This day is already rejected.", 409);
      updated = await queryOne<AttendanceRow>(
        `UPDATE attendance SET approval='rejected', rejection_reason=$1, reviewed_at=now(), reviewed_by=$2, review_note=NULL
         WHERE id=$3 RETURNING *`,
        [input.reason, auth.user.refId, id],
        tx,
      );
      notice = { type: "attendance_rejected", title: "Attendance rejected", message: `Your attendance for ${dayLabel} was rejected: ${input.reason}` };
    }

    await addNotification(tx, { ...notice, recipient: current.employee_id, href: "/employee/attendance" });
    return success(toAttendance(updated as AttendanceRow));
  });

  if (result.ok) await audit(`attendance.${input.decision}`, { actorUserId: auth.user.userId, target: id });
  return result;
}
