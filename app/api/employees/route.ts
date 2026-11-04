import { randomBytes } from "node:crypto";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { query, queryOne, transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/passwords";
import { EMPLOYEE_COLUMNS, toEmployee } from "@/lib/server/repo";

const employeeBody = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(20),
  department: z.string().trim().min(1).max(60),
  designation: z.string().trim().min(1).max(60),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthlyBasicSalary: z.number().positive().max(10_000_000),
});

export async function GET() {
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const rows = await query(`SELECT ${EMPLOYEE_COLUMNS} FROM employees ORDER BY full_name`);
  return success(rows.map((row) => toEmployee(row as never)));
}

/**
 * Creates the employee and their login. The generated temporary password is
 * returned once and must be changed at first sign-in.
 */
export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const parsed = employeeBody.safeParse(await readJson(request));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid employee details.");
  const input = parsed.data;

  const temporaryPassword = `${randomBytes(12).toString("base64url")}!1a`;
  const passwordHash = await hashPassword(temporaryPassword);

  const result = await transaction(async (tx) => {
    if (await queryOne("SELECT 1 FROM users WHERE lower(email) = $1", [input.email], tx)) {
      return failure("An account with that email already exists.", 409);
    }
    const seq = await queryOne<{ n: string }>("SELECT nextval('employee_number_seq') AS n", [], tx);
    const id = `EMP-${seq?.n}`;
    const row = await queryOne(
      `INSERT INTO employees (id, full_name, email, phone, department, designation, joining_date, monthly_basic_salary, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active') RETURNING ${EMPLOYEE_COLUMNS}`,
      [id, input.fullName, input.email, input.phone, input.department, input.designation, input.joiningDate, input.monthlyBasicSalary],
      tx,
    );
    await query(
      "INSERT INTO users (role, email, password_hash, ref_id, must_change_password) VALUES ('employee',$1,$2,$3,true)",
      [input.email, passwordHash, id],
      tx,
    );
    return success({ employee: toEmployee(row as never), temporaryPassword }, 201);
  });

  if (result.ok) await audit("employee.created", { actorUserId: auth.user.userId, target: input.email });
  return result;
}
