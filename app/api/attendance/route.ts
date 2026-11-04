import { query } from "@/lib/server/db";
import { failure, requireUser, success } from "@/lib/server/http";
import { toAttendance, type AttendanceRow } from "@/lib/server/repo";

/**
 * GET /api/attendance?month=YYYY-MM  or  ?date=YYYY-MM-DD   [&employeeId=...]
 * Employees only ever see their own records; admins can query anyone.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const month = params.get("month");
  const date = params.get("date");
  if (!month && !date) return failure("Provide ?month=YYYY-MM or ?date=YYYY-MM-DD.");
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return failure("month must look like 2026-11.");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return failure("date must look like 2026-11-04.");

  const employeeId = auth.user.role === "employee" ? auth.user.refId : params.get("employeeId");
  const clauses: string[] = [];
  const args: unknown[] = [];
  if (employeeId) {
    args.push(employeeId);
    clauses.push(`employee_id = $${args.length}`);
  }
  if (date) {
    args.push(date);
    clauses.push(`date = $${args.length}`);
  } else if (month) {
    args.push(`${month}-01`);
    clauses.push(`date >= $${args.length}::date AND date < ($${args.length}::date + interval '1 month')`);
  }

  const rows = await query<AttendanceRow>(
    `SELECT * FROM attendance WHERE ${clauses.join(" AND ")} ORDER BY date DESC, employee_id`,
    args,
  );
  return success(rows.map(toAttendance));
}
