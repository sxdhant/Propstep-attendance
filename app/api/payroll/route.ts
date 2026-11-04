import { z } from "zod";
import { failure, requireUser, success } from "@/lib/server/http";
import { getPool } from "@/lib/server/db";
import { buildRow, loadMonthData } from "@/lib/server/payroll";

const period = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

/**
 * GET /api/payroll?year=2026&month=10
 * Admins get every employee's line; employees get only their own.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const parsed = period.safeParse({ year: params.get("year"), month: params.get("month") });
  if (!parsed.success) return failure("Provide ?year=YYYY&month=1-12.");
  const { year, month } = parsed.data;

  const data = await loadMonthData(getPool(), year, month, auth.user.role === "employee" ? auth.user.refId : undefined);
  return success(data.employees.map((employee) => buildRow(data, employee, year, month)));
}
