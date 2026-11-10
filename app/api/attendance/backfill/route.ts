import { z } from "zod";
import { attendanceId } from "@/lib/attendance-utils";
import { BACKFILL_ALLOWED_MONTHS, BACKFILL_REMARK, planBackfillEntry, type BackfillEntry } from "@/lib/backfill";
import { toDateKey } from "@/lib/date-utils";
import { formatMonthYear } from "@/lib/format";
import { audit } from "@/lib/server/audit";
import { query, transaction } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { addNotification, EMPLOYEE_COLUMNS, loadHolidayMap, loadSettings, toEmployee } from "@/lib/server/repo";
import type { Employee } from "@/types/employee";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times must look like 09:30.");
const body = z.object({
  dryRun: z.boolean().optional(),
  entries: z
    .array(
      z.object({
        employeeId: z.string().min(1).max(40),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["present", "half_day", "absent", "week_off"]),
        checkIn: clock.optional(),
        checkOut: clock.optional(),
      }),
    )
    .min(1, "There is nothing to save.")
    .max(3000, "That is too many rows for one go. Split it into smaller batches."),
});

interface RowResult {
  index: number;
  employeeId: string;
  date: string;
  ok: boolean;
  action?: "save" | "clear";
  error?: string;
}

/**
 * Backfill attendance for an open past month. All-or-nothing: if any row breaks a rule, nothing is saved.
 * With `dryRun: true` it only reports what would happen, so a person can review before committing.
 */
export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;

  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid request.", 422);
  const { entries, dryRun = false } = parsed.data;

  const outcome = await transaction(async (tx) => {
    const settings = await loadSettings(tx);
    const holidays = await loadHolidayMap(tx);
    const today = toDateKey(new Date());

    const ids = [...new Set(entries.map((e) => e.employeeId))];
    const employees = new Map<string, Employee>();
    for (const row of await query(`SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE id = ANY($1)`, [ids], tx)) {
      const e = toEmployee(row as never);
      employees.set(e.id, e);
    }

    const recordIds = entries.map((e) => attendanceId(e.employeeId, e.date));
    const existing = new Map<string, { remarks: string | null }>();
    for (const row of await query<{ id: string; remarks: string | null }>(
      "SELECT id, remarks FROM attendance WHERE id = ANY($1)",
      [recordIds],
      tx,
    )) {
      existing.set(row.id, { remarks: row.remarks });
    }

    // A finalized or paid month is frozen. Read FOR SHARE so a payroll finalization in flight finishes first.
    const monthKeys = [...new Set(entries.map((e) => `${e.employeeId}_${e.date.slice(0, 7)}`))];
    const locked = new Set<string>();
    for (const row of await query<{ id: string; status: string }>(
      "SELECT id, data->>'status' AS status FROM payroll WHERE id = ANY($1) FOR SHARE",
      [monthKeys],
      tx,
    )) {
      if (row.status === "finalized" || row.status === "paid") locked.add(row.id);
    }

    const seen = new Set<string>();
    const plans = entries.map((entry: BackfillEntry, index) => {
      const key = attendanceId(entry.employeeId, entry.date);
      const duplicate = seen.has(key);
      seen.add(key);
      const plan = duplicate
        ? ({ ok: false, error: "This employee and date appear more than once." } as const)
        : planBackfillEntry(entry, {
            policy: settings.attendance,
            holidays,
            employee: employees.get(entry.employeeId),
            today,
            existing: existing.get(key) ?? null,
            locked: locked.has(`${entry.employeeId}_${entry.date.slice(0, 7)}`),
            allowedMonths: BACKFILL_ALLOWED_MONTHS,
          });
      return { entry, plan, index, key };
    });

    const results: RowResult[] = plans.map(({ entry, plan, index }) => ({
      index,
      employeeId: entry.employeeId,
      date: entry.date,
      ok: plan.ok,
      ...(plan.ok ? { action: plan.action } : { error: plan.error }),
    }));
    const errors = results.filter((r) => !r.ok).length;
    const summary = {
      rows: results.length,
      errors,
      toSave: results.filter((r) => r.action === "save").length,
      toClear: results.filter((r) => r.action === "clear").length,
    };
    if (dryRun || errors > 0) return { committed: false as const, results, summary };

    let created = 0;
    let updated = 0;
    let cleared = 0;
    const touched = new Set<string>();
    for (const { entry, plan, key } of plans) {
      if (!plan.ok) continue;
      if (plan.action === "clear") {
        const rows = await query("DELETE FROM attendance WHERE id = $1 AND remarks = $2 RETURNING id", [key, BACKFILL_REMARK], tx);
        if (rows.length) {
          cleared++;
          touched.add(entry.employeeId);
        }
        continue;
      }
      await query(
        `INSERT INTO attendance (id, employee_id, date, check_in, check_out, status, approval, remarks, reviewed_at, reviewed_by, review_note)
         VALUES ($1,$2,$3,$4,$5,$6::text,CASE WHEN $6::text = 'week_off' THEN 'not_required' ELSE 'approved' END,$7,now(),$8,'Entered by an administrator (backfill).')
         ON CONFLICT (id) DO UPDATE SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, status = EXCLUDED.status,
           approval = EXCLUDED.approval, reviewed_at = now(), reviewed_by = EXCLUDED.reviewed_by
         WHERE attendance.remarks = $7`,
        [key, entry.employeeId, entry.date, plan.checkIn, plan.checkOut, plan.status, BACKFILL_REMARK, auth.user.refId],
        tx,
      );
      if (existing.has(key)) updated++;
      else created++;
      touched.add(entry.employeeId);
    }

    // One short note per employee, not one per day.
    const months = [...new Set(entries.map((e) => e.date.slice(0, 7)))];
    const label = months.map((m) => formatMonthYear(Number(m.slice(0, 4)), Number(m.slice(5, 7)))).join(", ");
    for (const employeeId of touched) {
      await addNotification(tx, {
        recipient: employeeId,
        type: "attendance_approved",
        title: `${label} attendance added`,
        message: `Your administrator added your attendance for ${label}. You can review it under My Attendance.`,
        href: "/employee/attendance",
      });
    }
    return { committed: true as const, results, summary, created, updated, cleared, employees: touched.size, label };
  });

  if (!outcome.committed) {
    if (!dryRun) {
      return Response.json(
        { ok: false, error: `${outcome.summary.errors} row(s) can't be saved, so nothing was saved.`, results: outcome.results },
        { status: 422 },
      );
    }
    return success({ dryRun: true, results: outcome.results, summary: outcome.summary });
  }

  await audit("attendance.backfill", {
    actorUserId: auth.user.userId,
    target: outcome.label,
    meta: { created: outcome.created, updated: outcome.updated, cleared: outcome.cleared, employees: outcome.employees },
  });
  return success({
    dryRun: false,
    created: outcome.created,
    updated: outcome.updated,
    cleared: outcome.cleared,
    employees: outcome.employees,
    results: outcome.results,
    summary: outcome.summary,
  });
}
