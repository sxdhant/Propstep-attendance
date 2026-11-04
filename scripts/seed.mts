/**
 * Seeds an empty database.
 *
 *   Production:  ADMIN_EMAIL, ADMIN_PASSWORD [, ADMIN_NAME] -> creates the first administrator
 *                (settings and holidays are added too). The admin must change the password on first login.
 *   Development: SEED_DEMO=true -> also loads the demo employees, attendance and payroll.
 *                Refused when NODE_ENV=production.
 *
 *   npm run db:seed
 */
import "./load-env.mts";
import pg from "pg";
import { adminDatabaseUrl, pgOptions } from "../lib/db-config";
import { DEMO_ACCOUNTS, DEFAULT_SETTINGS } from "../lib/constants";
import { createSeedDatabase } from "../lib/mock-data";
import { checkPasswordPolicy, hashPassword } from "../lib/server/passwords";

const demo = process.env.SEED_DEMO === "true";
if (demo && process.env.NODE_ENV === "production") {
  console.error("Refusing to load demo data with demo passwords in production.");
  process.exit(1);
}

const client = new pg.Client(pgOptions(adminDatabaseUrl()));
await client.connect();

if ((await client.query("SELECT 1 FROM users LIMIT 1")).rowCount) {
  console.log("Users already exist; nothing to seed.");
  await client.end();
  process.exit(0);
}

const data = createSeedDatabase(new Date());
await client.query("BEGIN");
try {
  if (demo) {
    const adminHash = await hashPassword(DEMO_ACCOUNTS.admin.password);
    const empHash = await hashPassword(DEMO_ACCOUNTS.employee.password);
    for (const a of data.admins) {
      await client.query("INSERT INTO admins VALUES ($1,$2,$3,$4)", [a.id, a.fullName, a.email, a.title]);
      await client.query("INSERT INTO users (role,email,password_hash,ref_id) VALUES ('admin',$1,$2,$3)", [a.email, adminHash, a.id]);
    }
    for (const e of data.employees) {
      await client.query(
        "INSERT INTO employees (id,full_name,email,phone,department,designation,joining_date,monthly_basic_salary,status,deactivated_on,profile) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [e.id, e.fullName, e.email, e.phone, e.department, e.designation, e.joiningDate, e.monthlyBasicSalary, e.status, e.deactivatedOn ?? null, e.profile ? JSON.stringify(e.profile) : null],
      );
      await client.query("INSERT INTO users (role,email,password_hash,ref_id) VALUES ('employee',$1,$2,$3)", [e.email, empHash, e.id]);
    }
    for (const r of Object.values(data.attendance)) {
      await client.query(
        "INSERT INTO attendance (id,employee_id,date,check_in,check_out,status,approval,remarks,rejection_reason,reviewed_at,reviewed_by,review_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [r.id, r.employeeId, r.date, r.checkIn, r.checkOut, r.status, r.approval, r.remarks ?? null, r.rejectionReason ?? null, r.reviewedAt ?? null, r.reviewedBy ?? null, r.reviewNote ?? null],
      );
    }
    for (const n of data.notifications) {
      await client.query("INSERT INTO notifications (id,recipient,type,title,message,created_at,read,href) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [
        n.id, n.recipient, n.type, n.title, n.message, n.createdAt, n.read, n.href ?? null,
      ]);
    }
    for (const p of Object.values(data.payroll)) {
      await client.query("INSERT INTO payroll VALUES ($1,$2,$3)", [p.id, p.employeeId, JSON.stringify(p)]);
    }
    await client.query("SELECT setval('employee_number_seq', $1)", [
      Math.max(...data.employees.map((e) => Number(e.id.slice(4)))),
    ]);
    console.log("Loaded demo data.");
  } else {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (!email) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first administrator.");
    const problem = checkPasswordPolicy(password, { email });
    if (problem) throw new Error(`ADMIN_PASSWORD rejected: ${problem}`);
    await client.query("INSERT INTO admins VALUES ('ADM-001',$1,$2,'Administrator')", [process.env.ADMIN_NAME ?? "Administrator", email]);
    await client.query(
      "INSERT INTO users (role,email,password_hash,ref_id,must_change_password) VALUES ('admin',$1,$2,'ADM-001',true)",
      [email, await hashPassword(password)],
    );
    console.log(`Created administrator ${email} (must change password on first login).`);
  }
  for (const h of data.holidays) await client.query("INSERT INTO holidays VALUES ($1,$2)", [h.date, h.name]);
  await client.query("INSERT INTO settings VALUES ('app',$1)", [JSON.stringify(demo ? data.settings : DEFAULT_SETTINGS)]);
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
await client.end();
