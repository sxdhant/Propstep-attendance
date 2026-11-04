import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { query, queryOne, transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { findEmployee } from "@/lib/server/repo";

const patch = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().min(7).max(20),
    department: z.string().trim().min(1).max(60),
    designation: z.string().trim().min(1).max(60),
    monthlyBasicSalary: z.number().positive().max(10_000_000),
    status: z.enum(["active", "inactive"]),
  })
  .partial();

export async function GET(_request: Request, ctx: RouteContext<"/api/employees/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  // Employees may only read themselves.
  if (auth.user.role === "employee" && auth.user.refId !== id) return failure("You don't have permission to do that.", 403);
  const employee = await findEmployee(id);
  return employee ? success(employee) : failure("Employee not found.", 404);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/employees/[id]">) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const parsed = patch.safeParse(await readJson(request));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid employee details.");

  const result = await transaction(async (tx) => {
    const current = await findEmployee(id, tx, true);
    if (!current) return failure("Employee not found.", 404);
    const next = { ...current, ...parsed.data };
    if (next.email.toLowerCase() !== current.email.toLowerCase()) {
      const taken = await queryOne("SELECT 1 FROM users WHERE lower(email) = $1", [next.email.toLowerCase()], tx);
      if (taken) return failure("That email address already belongs to another account.", 409);
    }
    const inactive = next.status === "inactive";

    await query(
      `UPDATE employees SET full_name=$1, phone=$2, department=$3, designation=$4, monthly_basic_salary=$5, status=$6, email=$8,
         deactivated_on = CASE WHEN $6 = 'inactive' THEN COALESCE(deactivated_on, current_date) ELSE NULL END
       WHERE id=$7`,
      [next.fullName, next.phone, next.department, next.designation, next.monthlyBasicSalary, next.status, id, next.email],
      tx,
    );
    await query("UPDATE users SET email = $1 WHERE role='employee' AND ref_id = $2", [next.email, id], tx);
    // Deactivation locks the login and ends every live session immediately.
    await query("UPDATE users SET disabled = $1 WHERE role='employee' AND ref_id = $2", [inactive, id], tx);
    if (inactive) {
      await query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role='employee' AND ref_id = $1)", [id], tx);
    }
    return success(await findEmployee(id, tx));
  });

  if (result.ok) {
    await audit(parsed.data.status ? `employee.${parsed.data.status === "inactive" ? "deactivated" : "activated"}` : "employee.updated", {
      actorUserId: auth.user.userId,
      target: id,
    });
  }
  return result;
}
