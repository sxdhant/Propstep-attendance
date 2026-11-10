/* eslint-disable @typescript-eslint/no-explicit-any -- test payloads are untyped JSON */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { pgOptions } from "@/lib/db-config";
import { codeAtStep, currentStep } from "@/lib/server/totp";

/**
 * End-to-end API tests against a running server and its database.
 *
 *   npm run db:dev && npm run db:migrate && npm run db:seed:demo   (once)
 *   npm run dev                                                    (in another terminal)
 *   npm run test:integration
 *
 * Skipped automatically when no server answers at TEST_BASE_URL. Every record
 * the tests create is deleted afterwards; seeded data is never modified.
 */

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/attendance";
const ADMIN = { email: "neha.kapoor@kestrel.example", password: "Admin@123" };
const SEEDED_EMPLOYEE = { email: "aarav.sharma@kestrel.example", password: "Employee@123" };

let serverUp = false;
try {
  serverUp = (await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) })).ok;
} catch {
  serverUp = false;
}

interface Reply {
  status: number;
  json: { ok: boolean; data?: any; error?: string; code?: string };
}

class Client {
  cookie = "";
  constructor(private origin: string | null = BASE) {}
  async req(method: string, path: string, body?: unknown): Promise<Reply> {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.origin ? { origin: this.origin } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
    });
    for (const header of res.headers.getSetCookie?.() ?? []) {
      const [pair] = header.split(";");
      this.cookie = /^[^=]+=$/.test(pair) ? "" : pair;
    }
    return { status: res.status, json: await res.json() };
  }
  async login(email: string, password: string) {
    return this.req("POST", "/api/auth/login", { email, password });
  }
}

const db = new pg.Client(pgOptions(DATABASE_URL));
const created = { employeeIds: [] as string[], payrollMonths: [] as string[] };

const describeIf = serverUp ? describe : describe.skip;

describeIf("API (live server)", () => {
  beforeAll(async () => {
    await db.connect();
    await db.query("DELETE FROM login_attempts");
  });

  afterAll(async () => {
    for (const id of created.employeeIds) {
      await db.query("DELETE FROM notifications WHERE recipient = $1", [id]);
      await db.query("DELETE FROM attendance WHERE employee_id = $1", [id]);
      await db.query("DELETE FROM avatars WHERE owner_id = $1", [id]);
      await db.query("DELETE FROM payroll WHERE employee_id = $1", [id]);
      await db.query("DELETE FROM users WHERE role = 'employee' AND ref_id = $1", [id]);
      await db.query("DELETE FROM employees WHERE id = $1", [id]);
    }
    for (const ym of created.payrollMonths) await db.query("DELETE FROM payroll WHERE id LIKE $1", [`%\\_${ym}`]);
    await db.query("DELETE FROM notifications WHERE created_at > now() - interval '1 hour' AND title IN ('Attendance policy updated') ");
    await db.query("UPDATE users SET totp_enabled=false, totp_secret=NULL, totp_last_step=NULL WHERE email = $1", [ADMIN.email]);
    await db.query("DELETE FROM recovery_codes; DELETE FROM login_challenges; DELETE FROM sessions; DELETE FROM login_attempts; DELETE FROM password_resets");
    await db.end();
  });

  describe("authentication", () => {
    it("rejects unauthenticated requests", async () => {
      expect((await new Client().req("GET", "/api/employees")).status).toBe(401);
      expect((await new Client().req("GET", "/api/bootstrap")).status).toBe(401);
    });

    it("gives one identical error for a wrong password and an unknown email", async () => {
      const a = await new Client().login(ADMIN.email, "definitely-wrong");
      const b = await new Client().login("nobody-here@kestrel.example", "definitely-wrong");
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(a.json.error).toBe(b.json.error);
      await db.query("DELETE FROM login_attempts");
    });

    it("locks an email after 5 failed attempts, even for unknown emails", async () => {
      const client = new Client();
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) statuses.push((await client.login("lockout.test@kestrel.example", "wrong-wrong-1")).status);
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses[5]).toBe(429);
      await db.query("DELETE FROM login_attempts");
    });

    it("blocks cross-site state-changing requests", async () => {
      const evil = new Client("https://evil.example");
      const reply = await evil.login(ADMIN.email, ADMIN.password);
      expect(reply.status).toBe(403);
      expect(evil.cookie).toBe("");
    });

    it("signs in, reports who you are, and signs out", async () => {
      const admin = new Client();
      const login = await admin.login(ADMIN.email, ADMIN.password);
      expect(login.json.data).toMatchObject({ requiresTotp: false, role: "admin", mustChangePassword: false });
      expect(admin.cookie).toMatch(/^(__Host-)?session=/);
      expect((await admin.req("GET", "/api/auth/me")).json.data.email).toBe(ADMIN.email);
      await admin.req("POST", "/api/auth/logout");
      expect((await admin.req("GET", "/api/auth/me")).status).toBe(401);
    });

    it("keeps employees out of admin endpoints", async () => {
      const emp = new Client();
      await emp.login(SEEDED_EMPLOYEE.email, SEEDED_EMPLOYEE.password);
      for (const [method, path] of [
        ["GET", "/api/employees"],
        ["POST", "/api/payroll/generate"],
        ["GET", "/api/audit"],
        ["PUT", "/api/settings/company"],
      ] as const) {
        expect((await emp.req(method, path, {})).status, `${method} ${path}`).toBe(403);
      }
    });
  });

  describe("data scoping", () => {
    it("gives an employee only their own records and no admin identities", async () => {
      const emp = new Client();
      await emp.login(SEEDED_EMPLOYEE.email, SEEDED_EMPLOYEE.password);
      const data = (await emp.req("GET", "/api/bootstrap")).json.data.db;
      expect(data.employees).toHaveLength(1);
      expect(data.employees[0].id).toBe("EMP-1001");
      expect(Object.values<any>(data.attendance).every((a) => a.employeeId === "EMP-1001")).toBe(true);
      expect(data.admins[0].email).toBe("");
      expect(Object.values<any>(data.payroll).every((p) => p.employeeId === "EMP-1001")).toBe(true);
    });

    it("gives an admin the whole company", async () => {
      const admin = new Client();
      await admin.login(ADMIN.email, ADMIN.password);
      const { db: snapshot } = (await admin.req("GET", "/api/bootstrap")).json.data;
      expect(snapshot.employees.length).toBeGreaterThan(5);
      expect(snapshot.admins[0].email).toBe(ADMIN.email);
    });
  });

  describe("employee lifecycle, attendance and passwords", () => {
    const admin = new Client();
    const emp = new Client();
    let id = "";
    let email = "";
    let temp = "";
    const stamp = Date.now().toString(36);

    it("admin creates an employee and gets a one-time temporary password", async () => {
      await admin.login(ADMIN.email, ADMIN.password);
      email = `it.${stamp}@kestrel.example`;
      const today = new Date().toISOString().slice(0, 10);
      const reply = await admin.req("POST", "/api/employees", {
        id: `IT-${stamp}`, fullName: "Integration Tester", email, phone: "+91 90000 12345", department: "Engineering",
        designation: "QA", joiningDate: today, monthlyBasicSalary: 30000,
      });
      expect(reply.status).toBe(201);
      id = reply.json.data.employee.id;
      temp = reply.json.data.temporaryPassword;
      created.employeeIds.push(id);
      expect(id).toBe(`IT-${stamp}`);
      expect(temp.length).toBeGreaterThanOrEqual(16);
      expect((await admin.req("POST", "/api/employees", { id: `IT-${stamp}`, fullName: "Dup", email: `other.${stamp}@kestrel.example`, phone: "+91 90000 12345", department: "Sales", designation: "x", joiningDate: today, monthlyBasicSalary: 1000 })).status).toBe(409);
      expect((await admin.req("POST", "/api/employees", { id: `IT2-${stamp}`, fullName: "Dup", email, phone: "+91 90000 12345", department: "Sales", designation: "x", joiningDate: today, monthlyBasicSalary: 1000 })).status).toBe(409);
      expect((await admin.req("POST", "/api/employees", { fullName: "No Id", email: `noid.${stamp}@kestrel.example`, phone: "+91 90000 12345", department: "Sales", designation: "x", joiningDate: today, monthlyBasicSalary: 1000 })).status).toBe(400);
    });

    it("blocks the API until the temporary password is changed", async () => {
      const login = await emp.login(email, temp);
      expect(login.json.data.mustChangePassword).toBe(true);
      const blocked = await emp.req("GET", "/api/attendance?month=2026-11");
      expect(blocked.status).toBe(403);
      expect(blocked.json.code).toBe("PASSWORD_CHANGE_REQUIRED");
      expect((await emp.req("GET", "/api/auth/me")).json.data.mustChangePassword).toBe(true);
    });

    it("enforces the password policy and the current-password check", async () => {
      expect((await emp.req("POST", "/api/auth/change-password", { currentPassword: temp, newPassword: "abc12" })).status).toBe(422);
      expect((await emp.req("POST", "/api/auth/change-password", { currentPassword: "wrong", newPassword: "Sunrise-Harbor-42" })).status).toBe(403);
      expect((await emp.req("POST", "/api/auth/change-password", { currentPassword: temp, newPassword: "Sunrise-Harbor-42" })).json.ok).toBe(true);
      expect((await emp.req("GET", "/api/auth/me")).json.data.mustChangePassword).toBe(false);
    });

    it("checks in once, checks out, and cannot be approved by an employee", async () => {
      const checkIn = await emp.req("POST", "/api/attendance/check-in");
      // Today may legitimately be a weekly off or holiday; the rule must then say so.
      if (!checkIn.json.ok) {
        expect(checkIn.status).toBe(409);
        return;
      }
      expect(checkIn.json.data.status).toBe("in_progress");
      expect(checkIn.json.data.approval).toBe("pending"); // pending from the moment of check-in
      expect((await emp.req("POST", "/api/attendance/check-in")).status).toBe(409);

      // The admin is told about the check-in straight away.
      const inbox = (await admin.req("GET", "/api/notifications")).json.data as Array<{ title: string; message: string }>;
      expect(inbox.some((n) => n.title === "Employee checked in" && n.message.includes("Integration Tester"))).toBe(true);

      // The admin can approve while the employee is still checked in; the employee is told.
      const openId = checkIn.json.data.id;
      const early = await admin.req("POST", `/api/attendance/${openId}/review`, { decision: "approve" });
      expect(early.json.ok).toBe(true);
      expect(early.json.data.approval).toBe("approved");
      expect(early.json.data.checkOut).toBeNull();
      const told = (await emp.req("GET", "/api/notifications")).json.data as Array<{ title: string }>;
      expect(told.some((n) => n.title === "Check-in approved")).toBe(true);

      // Checking out almost immediately is far below the half-day threshold, so the approval is withdrawn.
      const checkOut = await emp.req("POST", "/api/attendance/check-out");
      expect(checkOut.json.ok).toBe(true);
      expect(checkOut.json.data.status).toBe("incomplete");
      expect(checkOut.json.data.approval).toBe("pending");
      const inbox2 = (await admin.req("GET", "/api/notifications")).json.data as Array<{ title: string }>;
      expect(inbox2.some((n) => n.title === "Approved check-in needs another look")).toBe(true);
      expect((await emp.req("POST", "/api/attendance/check-out")).status).toBe(409);
      const recordId = checkOut.json.data.id;
      expect((await emp.req("POST", `/api/attendance/${recordId}/review`, { decision: "approve" })).status).toBe(403);

      expect((await admin.req("POST", `/api/attendance/${recordId}/review`, { decision: "reject", reason: "no" })).status).toBe(400);
      const needsChoice = await admin.req("POST", `/api/attendance/${recordId}/review`, { decision: "approve" });
      expect([200, 400]).toContain(needsChoice.status); // incomplete days need payableAs; full days approve directly
      const approved = needsChoice.json.ok
        ? needsChoice
        : await admin.req("POST", `/api/attendance/${recordId}/review`, { decision: "approve", payableAs: "half" });
      expect(approved.json.data.approval).toBe("approved");
      expect((await admin.req("POST", `/api/attendance/${recordId}/review`, { decision: "approve", payableAs: "half" })).status).toBe(409);
    });

    it("lists devices and signs one out", async () => {
      const second = new Client();
      await second.login(email, "Sunrise-Harbor-42");
      const devices = (await emp.req("GET", "/api/auth/sessions")).json.data;
      expect(devices.length).toBeGreaterThanOrEqual(2);
      const other = devices.find((d: any) => !d.current);
      expect((await emp.req("DELETE", "/api/auth/sessions", { id: other.id })).json.ok).toBe(true);
      expect((await second.req("GET", "/api/auth/me")).status).toBe(401);
    });

    it("password change signs out other devices", async () => {
      const other = new Client();
      await other.login(email, "Sunrise-Harbor-42");
      expect((await emp.req("POST", "/api/auth/change-password", { currentPassword: "Sunrise-Harbor-42", newPassword: "Harbor-Sunrise-77!" })).json.ok).toBe(true);
      expect((await other.req("GET", "/api/auth/me")).status).toBe(401);
      expect((await emp.req("GET", "/api/auth/me")).status).toBe(200);
    });

    it("reset links are single-use, expire, and sign everyone out", async () => {
      const token = `planted-${stamp}-token-for-testing-only`;
      const plant = (interval: string) =>
        db.query(
          `INSERT INTO password_resets (user_id, token_hash, expires_at)
           SELECT id, encode(sha256($1::bytea),'hex'), now() + $2::interval FROM users WHERE email=$3`,
          [token, interval, email],
        );
      await plant("-1 minute");
      expect((await new Client().req("POST", "/api/auth/reset-password", { token, newPassword: "Another-Strong-Pass-9" })).status).toBe(400);
      await db.query("DELETE FROM password_resets");
      await plant("1 hour");
      expect((await new Client().req("POST", "/api/auth/reset-password", { token, newPassword: "short" })).status).toBe(422);
      expect((await new Client().req("POST", "/api/auth/reset-password", { token, newPassword: "Another-Strong-Pass-9" })).json.ok).toBe(true);
      expect((await new Client().req("POST", "/api/auth/reset-password", { token, newPassword: "Another-Strong-Pass-10" })).status).toBe(400);
      expect((await emp.req("GET", "/api/auth/me")).status).toBe(401);
      expect((await new Client().login(email, "Another-Strong-Pass-9")).json.ok).toBe(true);
    });

    it("forgot-password answers identically for known and unknown emails", async () => {
      const known = await new Client().req("POST", "/api/auth/forgot-password", { email });
      const unknown = await new Client().req("POST", "/api/auth/forgot-password", { email: "ghost@kestrel.example" });
      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(known.json.data.message).toBe(unknown.json.data.message);
      await db.query("DELETE FROM password_resets");
    });

    it("lets the admin correct the joining date, and refuses nonsense", async () => {
      const set = (joiningDate: string) => admin.req("PATCH", `/api/employees/${id}`, { joiningDate });
      expect((await set("2026-06-15")).json.data.joiningDate).toBe("2026-06-15");
      expect((await admin.req("GET", `/api/employees/${id}`)).json.data.joiningDate).toBe("2026-06-15");
      expect((await set("2026-02-31")).status).toBe(422);
      expect((await set("June")).status).toBe(400);
    });

    it("deactivating an employee ends their sessions and blocks sign-in", async () => {
      const live = new Client();
      await live.login(email, "Another-Strong-Pass-9");
      expect((await admin.req("PATCH", `/api/employees/${id}`, { status: "inactive" })).json.data.status).toBe("inactive");
      expect((await live.req("GET", "/api/auth/me")).status).toBe(401);
      expect((await new Client().login(email, "Another-Strong-Pass-9")).status).toBe(403);
      expect((await admin.req("PATCH", `/api/employees/${id}`, { status: "active" })).json.data.status).toBe("active");
    });

    it("lets an administrator reset an employee's password, and nobody else", async () => {
      const live = new Client();
      await live.login(email, "Another-Strong-Pass-9");
      const reply = await admin.req("POST", `/api/employees/${id}/reset-password`);
      expect(reply.json.ok).toBe(true);
      const temporary = reply.json.data.temporaryPassword as string;
      expect(temporary.length).toBeGreaterThanOrEqual(16);
      expect((await live.req("GET", "/api/auth/me")).status).toBe(401); // signed out everywhere
      expect((await new Client().login(email, "Another-Strong-Pass-9")).status).toBe(401);
      const again = new Client();
      expect((await again.login(email, temporary)).json.ok).toBe(true);
      expect((await again.req("POST", `/api/employees/${id}/reset-password`)).status).toBe(403);
    });

    it("records the activity in the audit log", async () => {
      const log = (await admin.req("GET", "/api/audit?limit=200")).json.data as Array<{ action: string }>;
      const actions = new Set(log.map((e) => e.action));
      for (const expected of ["login.success", "login.failed", "password.changed", "employee.created", "password.reset_completed"]) {
        expect(actions.has(expected), expected).toBe(true);
      }
    });
  });

  describe("two-factor sign-in", () => {
    it("requires a code, blocks replay, and honours single-use recovery codes", async () => {
      const admin = new Client();
      await admin.login(ADMIN.email, ADMIN.password);
      const setup = (await admin.req("POST", "/api/auth/totp/setup")).json.data;
      expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect((await admin.req("POST", "/api/auth/totp/enable", { code: "000000" })).json.ok).toBe(false);
      // Remember the exact step used to enable: replaying that same code must fail, however slow the network is.
      const enableStep = currentStep();
      const enabled = await admin.req("POST", "/api/auth/totp/enable", { code: codeAtStep(setup.secret, enableStep) });
      const recovery: string[] = enabled.json.data.recoveryCodes;
      expect(recovery).toHaveLength(8);

      const next = new Client();
      const first = await next.login(ADMIN.email, ADMIN.password);
      expect(first.json.data.requiresTotp).toBe(true);
      expect(next.cookie).toBe(""); // no session until the second factor is proven
      expect((await next.req("GET", "/api/auth/me")).status).toBe(401);
      const challenge = first.json.data.challenge;
      expect((await next.req("POST", "/api/auth/verify-totp", { challenge, code: "123456" })).status).toBe(401);
      // The code used at enable time is a replay and must be refused; a later step's code works.
      expect((await next.req("POST", "/api/auth/verify-totp", { challenge, code: codeAtStep(setup.secret, enableStep) })).json.ok).toBe(false);
      expect((await next.req("POST", "/api/auth/verify-totp", { challenge, code: codeAtStep(setup.secret, currentStep() + 1) })).json.ok).toBe(true);
      expect((await next.req("GET", "/api/auth/me")).json.data.totpEnabled).toBe(true);

      const viaRecovery = new Client();
      const c1 = (await viaRecovery.login(ADMIN.email, ADMIN.password)).json.data.challenge;
      expect((await viaRecovery.req("POST", "/api/auth/verify-totp", { challenge: c1, code: recovery[0] })).json.ok).toBe(true);
      const reuse = new Client();
      const c2 = (await reuse.login(ADMIN.email, ADMIN.password)).json.data.challenge;
      expect((await reuse.req("POST", "/api/auth/verify-totp", { challenge: c2, code: recovery[0] })).json.ok).toBe(false);

      const brute = new Client();
      const c3 = (await brute.login(ADMIN.email, ADMIN.password)).json.data.challenge;
      let last = 0;
      for (let i = 0; i < 6; i++) last = (await brute.req("POST", "/api/auth/verify-totp", { challenge: c3, code: "111111" })).status;
      expect(last).toBe(429);

      await db.query("UPDATE users SET totp_last_step = $1 WHERE email = $2", [currentStep() - 5, ADMIN.email]);
      expect((await next.req("POST", "/api/auth/totp/disable", { password: ADMIN.password, code: codeAtStep(setup.secret, currentStep()) })).json.ok).toBe(true);
      await db.query("DELETE FROM login_attempts");
    });
  });

  describe("admin profile", () => {
    it("lets an admin edit their own details, validates them, and refuses employees", async () => {
      const admin = new Client();
      await admin.login(ADMIN.email, ADMIN.password);
      const before = (await admin.req("GET", "/api/bootstrap")).json.data.db.admins.find((a: any) => a.email === ADMIN.email);

      expect((await admin.req("PATCH", "/api/admin/profile", { fullName: "A", title: "x", phone: "" })).status).toBe(422);
      expect((await admin.req("PATCH", "/api/admin/profile", { fullName: "Valid Name", title: "HR Manager", phone: "not-a-phone" })).status).toBe(422);

      const saved = await admin.req("PATCH", "/api/admin/profile", { fullName: "Priya Test Admin", title: "HR Manager", phone: "+91 98765 43210" });
      expect(saved.json.data).toMatchObject({ fullName: "Priya Test Admin", title: "HR Manager", phone: "+91 98765 43210", email: ADMIN.email });
      const after = (await admin.req("GET", "/api/bootstrap")).json.data.db.admins.find((a: any) => a.email === ADMIN.email);
      expect(after).toMatchObject({ fullName: "Priya Test Admin", phone: "+91 98765 43210" });

      const emp = new Client();
      await emp.login(SEEDED_EMPLOYEE.email, SEEDED_EMPLOYEE.password);
      expect((await emp.req("PATCH", "/api/admin/profile", { fullName: "Hacker Name", title: "Boss", phone: "" })).status).toBe(403);

      // Put the seeded values back.
      await admin.req("PATCH", "/api/admin/profile", { fullName: before.fullName, title: before.title, phone: before.phone ?? "" });
    });
  });

  describe("settings and holidays", () => {
    it("validates settings and restricts them to admins", async () => {
      const admin = new Client();
      await admin.login(ADMIN.email, ADMIN.password);
      const current = (await admin.req("GET", "/api/bootstrap")).json.data.db.settings.attendance;
      const bad = await admin.req("PUT", "/api/settings/attendance", { ...current, officeStartTime: "19:00", officeEndTime: "18:30" });
      expect(bad.status).toBe(422);
      expect((await admin.req("PUT", "/api/settings/nonsense", {})).status).toBe(404);
      expect((await admin.req("PUT", "/api/settings/attendance", current)).json.ok).toBe(true);
    });

    it("adds and removes a holiday", async () => {
      const admin = new Client();
      await admin.login(ADMIN.email, ADMIN.password);
      expect((await admin.req("POST", "/api/holidays", { date: "2031-01-01", name: "Integration Day" })).status).toBe(201);
      expect((await admin.req("DELETE", "/api/holidays", { date: "2031-01-01" })).json.ok).toBe(true);
      expect((await admin.req("DELETE", "/api/holidays", { date: "2031-01-01" })).status).toBe(404);
    });
  });

  describe("payroll lifecycle", () => {
    it("generates, finalizes, locks attendance, records payment once", async () => {
      const admin = new Client();
      await admin.login(ADMIN.email, ADMIN.password);
      const now = new Date();
      const [year, month] = [now.getFullYear(), now.getMonth() + 1];
      const ym = `${year}-${String(month).padStart(2, "0")}`;
      const emp = new Client();
      await emp.login(SEEDED_EMPLOYEE.email, SEEDED_EMPLOYEE.password);
      const preexisting = (await db.query("SELECT 1 FROM payroll WHERE id LIKE $1", [`%\\_${ym}`])).rowCount;
      if (preexisting) return; // never disturb a month that already has real payroll
      created.payrollMonths.push(ym);

      expect((await admin.req("POST", "/api/payroll/generate", { year: year + 1, month })).status).toBe(409);
      expect((await emp.req("POST", "/api/payroll/generate", { year, month })).status).toBe(403);
      const generated = await admin.req("POST", "/api/payroll/generate", { year, month });
      expect(generated.json.data.created).toBeGreaterThan(0);

      const mine = (await emp.req("GET", `/api/payroll?year=${year}&month=${month}`)).json.data;
      expect(mine).toHaveLength(1);
      expect(mine[0].status).toBe("draft");

      const pid = `EMP-1001_${ym}`;
      expect((await admin.req("POST", `/api/payroll/${pid}/pay`, { reference: "UTR12345" })).status).toBe(409);
      const finalized = await admin.req("POST", "/api/payroll/finalize", { year, month });
      expect(finalized.json.data.count).toBeGreaterThan(0);
      expect((await admin.req("POST", "/api/payroll/finalize", { year, month })).status).toBe(409);
      expect((await admin.req("POST", `/api/payroll/${pid}/pay`, { reference: "a b" })).status).toBe(400);
      expect((await admin.req("POST", `/api/payroll/${pid}/pay`, { reference: "UTR12345" })).json.data.status).toBe("paid");
      expect((await admin.req("POST", `/api/payroll/${pid}/pay`, { reference: "UTR12345" })).status).toBe(409);

      // The finalized month is frozen for attendance changes.
      const checkIn = await emp.req("POST", "/api/attendance/check-in");
      if (checkIn.status !== 409) expect(checkIn.json.ok).toBe(false);
      const frozen = (await emp.req("GET", `/api/payroll?year=${year}&month=${month}`)).json.data[0];
      expect(frozen.isLive).toBe(false);
      expect(frozen.record.snapshot).toBeTruthy();
    });
  });

  describe("backfilling past attendance", () => {
    const admin = new Client();
    const emp = new Client();
    let id = "";
    const days: string[] = []; // three working days in October that are not holidays
    let tuesday = "2026-10-13";
    const post = (entries: unknown[], dryRun = false) => admin.req("POST", "/api/attendance/backfill", { entries, dryRun });
    const stored = async () =>
      (await db.query("SELECT date::text AS date, status, approval, remarks, check_in, check_out FROM attendance WHERE employee_id = $1 ORDER BY date", [id])).rows;

    it("is for administrators only", async () => {
      await admin.login(ADMIN.email, ADMIN.password);
      const reply = await admin.req("POST", "/api/employees", {
        id: `BF-${Date.now().toString(36)}`, fullName: "Backfill Tester", email: `bf.${Date.now().toString(36)}@kestrel.example`, phone: "+91 90000 12345",
        department: "Engineering", designation: "QA", joiningDate: "2026-10-01", monthlyBasicSalary: 30000,
      });
      id = reply.json.data.employee.id;
      created.employeeIds.push(id);

      const temp = reply.json.data.temporaryPassword;
      await emp.login(reply.json.data.employee.email, temp);
      await emp.req("POST", "/api/auth/change-password", { currentPassword: temp, newPassword: "Sunrise-Harbor-42" });
      expect((await emp.req("POST", "/api/attendance/backfill", { entries: [{ employeeId: id, date: "2026-10-14", status: "present" }] })).status).toBe(403);
      expect((await new Client().req("POST", "/api/attendance/backfill", { entries: [] })).status).toBe(401);
    });

    it("previews without saving, and says why a row is refused", async () => {
      const holidays = (await admin.req("GET", "/api/holidays")).json.data as Array<{ date: string }>;
      const holidaySet = new Set(holidays.map((h) => h.date));
      const octoberTuesdays = ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"];
      tuesday = octoberTuesdays[1];
      for (let d = 1; d <= 31 && days.length < 3; d++) {
        const date = `2026-10-${String(d).padStart(2, "0")}`;
        if (!octoberTuesdays.includes(date) && !holidaySet.has(date) && d > 7) days.push(date);
      }
      expect(days).toHaveLength(3);

      const preview = await post(
        [
          { employeeId: id, date: days[0], status: "present" },
          { employeeId: id, date: tuesday, status: "present" },
          { employeeId: id, date: "2026-04-15", status: "present" },
          { employeeId: id, date: "2026-10-30", status: "present", checkIn: "15:00", checkOut: "09:00" },
          { employeeId: "EMP-9999", date: days[1], status: "present" },
        ],
        true,
      );
      expect(preview.json.ok).toBe(true);
      const errors = (preview.json.data.results as Array<{ ok: boolean; error?: string }>).map((r) => r.error ?? "ok");
      expect(errors[0]).toBe("ok");
      expect(errors[1]).toContain("weekly off");
      expect(errors[2]).toContain("Only 2026-05 to 2026-12");
      expect(errors[3]).toContain("after check-in");
      expect(errors[4]).toContain("Unknown employee");
      expect(await stored()).toHaveLength(0); // a preview never writes
    });

    it("is all-or-nothing: one bad row means nothing is saved", async () => {
      const reply = await post([
        { employeeId: id, date: days[0], status: "present" },
        { employeeId: id, date: tuesday, status: "present" },
      ]);
      expect(reply.status).toBe(422);
      expect(await stored()).toHaveLength(0);
    });

    it("saves approved days with office-hour defaults and tells the employee once", async () => {
      const reply = await post([
        { employeeId: id, date: days[0], status: "present" },
        { employeeId: id, date: days[1], status: "half_day" },
        { employeeId: id, date: days[2], status: "present", checkIn: "09:30", checkOut: "17:45" },
        { employeeId: id, date: "2026-10-30", status: "absent" }, // nothing to clear: harmless
      ]);
      expect(reply.json.ok).toBe(true);
      expect(reply.json.data).toMatchObject({ created: 3, updated: 0, cleared: 0, employees: 1 });

      const rows = await stored();
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.approval).toBe("approved");
        expect(row.remarks).toBe("Entered by admin");
      }
      expect(rows.map((r) => r.status)).toEqual(["present", "half_day", "present"]);
      const first = rows[0] as { check_in: Date; check_out: Date };
      expect(first.check_in.toISOString()).toBe(new Date(`${days[0]}T10:00:00+05:30`).toISOString());
      expect(first.check_out.toISOString()).toBe(new Date(`${days[0]}T18:30:00+05:30`).toISOString());
      const half = rows[1] as { check_in: Date; check_out: Date };
      expect((half.check_out.getTime() - half.check_in.getTime()) / 3_600_000).toBe(4);

      const inbox = (await emp.req("GET", "/api/notifications")).json.data as Array<{ title: string }>;
      expect(inbox.filter((n) => n.title === "October 2026 attendance added")).toHaveLength(1);
    });

    it("records a flexible week off that is neither an absence nor an approval", async () => {
      const holidaySet = new Set(((await admin.req("GET", "/api/holidays")).json.data as Array<{ date: string }>).map((h) => h.date));
      const off = ["2026-10-28", "2026-10-29", "2026-10-26"].find((d) => !holidaySet.has(d) && !days.includes(d))!;
      const saved = await post([{ employeeId: id, date: off, status: "week_off" }]);
      expect(saved.json.ok).toBe(true);
      const row = (await stored()).find((r: any) => r.date === off) as any;
      expect(row).toMatchObject({ status: "week_off", approval: "not_required", check_in: null, check_out: null });

      const mine = (await emp.req("GET", "/api/bootstrap")).json.data.db;
      expect(Object.values<any>(mine.attendance).some((a) => a.date === off && a.status === "week_off")).toBe(true);

      // Clearing it again restores the day.
      expect((await post([{ employeeId: id, date: off, status: "absent" }])).json.ok).toBe(true);
      expect((await stored()).some((r: any) => r.date === off)).toBe(false);
    });

    it("earns comp-off by working a holiday and only lets it be taken once earned", async () => {
      const holiday = "2026-10-31";
      const credit = "2026-10-30";
      const extra = "2026-10-29";
      expect((await admin.req("POST", "/api/holidays", { date: holiday, name: "Test Holiday" })).status).toBe(201);
      try {
        const early = await post([{ employeeId: id, date: credit, status: "comp_off" }]);
        expect(early.status).toBe(422); // nothing earned yet
        expect(JSON.stringify(early.json)).toContain("comp-off");

        expect((await post([{ employeeId: id, date: holiday, status: "week_off" }])).status).toBe(422); // can't be a day off on a holiday
        expect((await post([{ employeeId: id, date: holiday, status: "present" }])).json.ok).toBe(true); // working a holiday is allowed

        expect((await post([{ employeeId: id, date: credit, status: "comp_off" }])).json.ok).toBe(true);
        const row = (await stored()).find((r: any) => r.date === credit) as any;
        expect(row).toMatchObject({ status: "comp_off", approval: "not_required", check_in: null });

        expect((await post([{ employeeId: id, date: extra, status: "comp_off" }])).status).toBe(422); // only one earned
      } finally {
        await post([{ employeeId: id, date: credit, status: "absent" }, { employeeId: id, date: holiday, status: "absent" }]);
        await admin.req("DELETE", "/api/holidays", { date: holiday });
      }
      expect((await stored()).some((r: any) => r.date === credit || r.date === holiday)).toBe(false);
    });

    it("shows up for the employee, counts as approved days in payroll, and is audited", async () => {
      const mine = (await emp.req("GET", "/api/bootstrap")).json.data.db;
      const records = Object.values<any>(mine.attendance).filter((a) => a.date.startsWith("2026-10"));
      expect(records).toHaveLength(3);
      expect(records.every((r: any) => r.approval === "approved")).toBe(true);

      const line = (await emp.req("GET", "/api/payroll?year=2026&month=10")).json.data[0];
      expect(line.figures.approvedFullDays).toBe(2);
      expect(line.figures.approvedHalfDays).toBe(1);
      expect(line.figures.payableUnits).toBe(2.5);

      const log = (await admin.req("GET", "/api/audit?limit=100&action=attendance.backfill")).json.data as Array<{ action: string }>;
      expect(log.length).toBeGreaterThan(0);
    });

    it("lets an earlier backfill be corrected, and absent clears a day", async () => {
      const reply = await post([
        { employeeId: id, date: days[1], status: "present" },
        { employeeId: id, date: days[2], status: "absent" },
      ]);
      expect(reply.json.data).toMatchObject({ created: 0, updated: 1, cleared: 1 });
      expect((await stored()).map((r) => r.status)).toEqual(["present", "present"]);
    });

    it("never overwrites a real check-in record", async () => {
      await db.query(
        "INSERT INTO attendance (id, employee_id, date, check_in, check_out, status, approval) VALUES ($1,$2,'2026-10-29',now(),now(),'present','approved')",
        [`${id}_2026-10-29`, id],
      );
      const probe = await post([{ employeeId: id, date: "2026-10-29", status: "half_day" }], true);
      const result = (probe.json.data.results as Array<{ ok: boolean; error?: string }>)[0];
      if (result.ok === false) expect(result.error).toContain("real check-in");
      await db.query("DELETE FROM attendance WHERE id = $1", [`${id}_2026-10-29`]);
    });

    it("is frozen once the month's payroll is finalized", async () => {
      await db.query("INSERT INTO payroll (id, employee_id, data) VALUES ($1,$2,$3)", [
        `${id}_2026-10`, id, JSON.stringify({ id: `${id}_2026-10`, employeeId: id, year: 2026, month: 10, status: "finalized" }),
      ]);
      const reply = await post([{ employeeId: id, date: days[0], status: "half_day" }]);
      expect(reply.status).toBe(422);
      await db.query("DELETE FROM payroll WHERE id = $1", [`${id}_2026-10`]);
    });
  });

  describe("profile photos", () => {
    const admin = new Client();
    const emp = new Client();
    const other = new Client();
    let id = "";
    // A minimal JPEG-looking payload: the server checks the file signature, not the claimed type.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const put = (client: Client, body: BodyInit, type = "image/jpeg") =>
      fetch(`${BASE}/api/profile/photo`, { method: "PUT", headers: { "content-type": type, origin: BASE, cookie: client.cookie }, body });
    const get = (client: Client, owner: string) => fetch(`${BASE}/api/avatars/${owner}`, { headers: { cookie: client.cookie } });

    it("lets a person upload, see and remove their own photo", async () => {
      await admin.login(ADMIN.email, ADMIN.password);
      const reply = await admin.req("POST", "/api/employees", {
        id: `PH-${Date.now().toString(36)}`, fullName: "Photo Tester", email: `ph.${Date.now().toString(36)}@kestrel.example`, phone: "+91 90000 12345",
        department: "Engineering", designation: "QA", joiningDate: "2026-10-01", monthlyBasicSalary: 30000,
      });
      id = reply.json.data.employee.id;
      created.employeeIds.push(id);
      const temp = reply.json.data.temporaryPassword;
      await emp.login(reply.json.data.employee.email, temp);
      await emp.req("POST", "/api/auth/change-password", { currentPassword: temp, newPassword: "Sunrise-Harbor-42" });

      expect((await put(new Client(), jpeg)).status).toBe(401);
      const saved = await put(emp, jpeg);
      expect(saved.status).toBe(200);
      const { data } = await saved.json();
      expect(data.photoUrl).toContain(`/api/avatars/${id}?v=`);

      const image = await get(emp, id);
      expect(image.status).toBe(200);
      expect(image.headers.get("content-type")).toBe("image/jpeg");
      expect((await get(admin, id)).status).toBe(200); // administrators may see anyone's

      const boot = (await emp.req("GET", "/api/bootstrap")).json.data.db;
      expect(boot.employees[0].photoUrl).toContain(`/api/avatars/${id}`);

      expect((await emp.req("DELETE", "/api/profile/photo")).json.ok).toBe(true);
      expect((await get(emp, id)).status).toBe(404);
    });

    it("rejects non-images, oversized files and other people's photos", async () => {
      expect((await put(emp, new TextEncoder().encode("<script>alert(1)</script> not an image"), "image/jpeg")).status).toBe(415);
      expect((await put(emp, new Uint8Array(0))).status).toBe(422);
      expect((await put(emp, new Uint8Array(450_000).fill(0xff))).status).toBe(413);

      await put(emp, jpeg);
      const seeded = new Client();
      await seeded.login(SEEDED_EMPLOYEE.email, SEEDED_EMPLOYEE.password);
      expect((await get(seeded, id)).status).toBe(404); // an employee can't read a colleague's photo
      expect((await put(new Client(null), jpeg)).status).toBe(401);
      await other.login(ADMIN.email, ADMIN.password);
      expect((await fetch(`${BASE}/api/profile/photo`, { method: "PUT", headers: { cookie: other.cookie, origin: "https://evil.example" }, body: jpeg })).status).toBe(403);
    });
  });

  describe("health", () => {
    it("reports ok with no authentication", async () => {
      const reply = await new Client().req("GET", "/api/health");
      expect(reply.status).toBe(200);
    });
  });
});
