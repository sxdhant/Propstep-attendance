import { getDayKind } from "@/lib/attendance-utils";
import { addDays, parseClockTime, timestampOn } from "@/lib/date-utils";
import type { DateKey, IsoTimestamp } from "@/types/common";
import type { Employee } from "@/types/employee";
import type { AttendancePolicy } from "@/types/settings";

/**
 * Backfilling: an administrator enters attendance for days that happened before
 * the app was in use. The rules live here, in one pure module, so the browser
 * preview and the server decide exactly the same way.
 */

/** Months an administrator may backfill. Edit this list to open (or close) a month. */
export const BACKFILL_ALLOWED_MONTHS: readonly string[] = [
  "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
];

/** Stored in `remarks` so backfilled days are recognisable, and so they are the only days a backfill may change. */
export const BACKFILL_REMARK = "Entered by admin";

export type BackfillStatus = "present" | "half_day" | "absent";

export interface BackfillEntry {
  employeeId: string;
  date: DateKey;
  status: BackfillStatus;
  /** `HH:mm`, optional. Defaults to the office start time. */
  checkIn?: string;
  /** `HH:mm`, optional. Defaults to the office end time (present) or start plus the half-day threshold (half day). */
  checkOut?: string;
}

export interface PlanContext {
  policy: AttendancePolicy;
  holidays: Record<DateKey, string>;
  employee: Employee | undefined;
  today: DateKey;
  /** The day's existing record, if any. */
  existing: { remarks?: string | null } | null;
  /** The month's payroll is finalized or paid. */
  locked: boolean;
  allowedMonths: readonly string[];
}

export type Plan =
  | { ok: true; action: "save"; status: "present" | "half_day"; checkIn: IsoTimestamp; checkOut: IsoTimestamp }
  | { ok: true; action: "clear" }
  | { ok: false; error: string };

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isBackfilled(record: { remarks?: string | null } | null | undefined): boolean {
  return record?.remarks === BACKFILL_REMARK;
}

/** Decides whether one row may be saved and, if so, exactly what is stored. */
export function planBackfillEntry(entry: BackfillEntry, ctx: PlanContext): Plan {
  const { employee, policy } = ctx;
  if (!employee) return { ok: false, error: `Unknown employee ${entry.employeeId}.` };
  if (!DATE.test(entry.date)) return { ok: false, error: `${entry.date} is not a valid date (use YYYY-MM-DD).` };
  if (!ctx.allowedMonths.includes(entry.date.slice(0, 7))) {
    return { ok: false, error: `Only ${ctx.allowedMonths.length > 1 ? `${ctx.allowedMonths[0]} to ${ctx.allowedMonths[ctx.allowedMonths.length - 1]}` : ctx.allowedMonths.join(", ")} can be backfilled.` };
  }
  if (entry.date > ctx.today) return { ok: false, error: "That date is in the future." };
  if (entry.date < employee.joiningDate) return { ok: false, error: `${employee.fullName} joined on ${employee.joiningDate}.` };
  if (employee.deactivatedOn && entry.date > employee.deactivatedOn) {
    return { ok: false, error: `${employee.fullName}'s account was deactivated on ${employee.deactivatedOn}.` };
  }

  const day = getDayKind(entry.date, { policy, holidays: ctx.holidays });
  if (day.kind === "holiday") return { ok: false, error: `${entry.date} is a holiday (${day.holidayName}).` };
  if (day.kind === "weekly_off") return { ok: false, error: `${entry.date} is a weekly off.` };

  if (ctx.locked) return { ok: false, error: "Payroll for this month is already finalized, so attendance can't be changed." };
  if (ctx.existing && !isBackfilled(ctx.existing)) {
    return { ok: false, error: "This day already has a real check-in record, which a backfill can't overwrite." };
  }

  if (entry.status === "absent") return { ok: true, action: "clear" };

  if ((entry.checkIn && !CLOCK.test(entry.checkIn)) || (entry.checkOut && !CLOCK.test(entry.checkOut))) {
    return { ok: false, error: "Times must look like 09:30." };
  }
  const start = parseClockTime(policy.officeStartTime);
  const checkInMinutes = entry.checkIn ? parseClockTime(entry.checkIn) : start;
  const checkOutMinutes = entry.checkOut
    ? parseClockTime(entry.checkOut)
    : entry.status === "half_day"
      ? checkInMinutes + Math.round(policy.halfDayThresholdHours * 60)
      : Math.max(parseClockTime(policy.officeEndTime), checkInMinutes + Math.round(policy.requiredWorkingHours * 60));
  if (checkOutMinutes <= checkInMinutes) return { ok: false, error: "Check-out must be after check-in." };
  if (checkOutMinutes - checkInMinutes > 20 * 60) return { ok: false, error: "That is more than 20 hours between check-in and check-out." };

  return {
    ok: true,
    action: "save",
    status: entry.status,
    checkIn: timestampOn(entry.date, checkInMinutes),
    checkOut: timestampOn(entry.date, checkOutMinutes),
  };
}

/* ----------------------------------- CSV ----------------------------------- */

export const CSV_HEADER = "employee_id,employee_name,date,status,check_in,check_out";

const STATUS_WORDS: Record<string, BackfillStatus> = {
  p: "present",
  present: "present",
  full: "present",
  "full day": "present",
  h: "half_day",
  half: "half_day",
  "half day": "half_day",
  "half-day": "half_day",
  half_day: "half_day",
  a: "absent",
  absent: "absent",
};

/** Splits one CSV line, honouring double quotes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  out.push(current.trim());
  return out;
}

export interface CsvParse {
  entries: BackfillEntry[];
  /** 1-based line numbers, as a spreadsheet shows them. */
  errors: Array<{ line: number; message: string }>;
  /** Rows with an empty status column are ignored on purpose, so a pre-filled template can be partly completed. */
  skipped: number;
}

export function parseBackfillCsv(text: string): CsvParse {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const result: CsvParse = { entries: [], errors: [], skipped: 0 };

  const headerIndex = lines.findIndex((l) => l.trim() !== "");
  if (headerIndex < 0) {
    result.errors.push({ line: 1, message: "The file is empty." });
    return result;
  }
  const header = splitLine(lines[headerIndex]).map((h) => h.toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idCol = col("employee_id", "employee", "id", "emp_id");
  const dateCol = col("date");
  const statusCol = col("status", "attendance");
  const inCol = col("check_in", "checkin", "in", "in_time");
  const outCol = col("check_out", "checkout", "out", "out_time");
  if (idCol < 0 || dateCol < 0 || statusCol < 0) {
    result.errors.push({ line: headerIndex + 1, message: "The first row must name the columns employee_id, date and status (check_in and check_out are optional)." });
    return result;
  }

  const seen = new Set<string>();
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const cells = splitLine(lines[i]);
    const line = i + 1;
    const rawStatus = (cells[statusCol] ?? "").trim().toLowerCase();
    if (rawStatus === "") {
      result.skipped++;
      continue;
    }
    const status = STATUS_WORDS[rawStatus];
    if (!status) {
      result.errors.push({ line, message: `"${cells[statusCol]}" is not a status. Use present, half_day or absent.` });
      continue;
    }
    const employeeId = (cells[idCol] ?? "").trim().toUpperCase();
    const date = (cells[dateCol] ?? "").trim();
    if (!employeeId) {
      result.errors.push({ line, message: "The employee_id is empty." });
      continue;
    }
    if (!DATE.test(date)) {
      result.errors.push({ line, message: `"${date}" is not a date. Use YYYY-MM-DD, like 2026-10-15.` });
      continue;
    }
    const key = `${employeeId}|${date}`;
    if (seen.has(key)) {
      result.errors.push({ line, message: `${employeeId} on ${date} appears more than once in the file.` });
      continue;
    }
    seen.add(key);
    const checkIn = inCol >= 0 ? (cells[inCol] ?? "").trim() : "";
    const checkOut = outCol >= 0 ? (cells[outCol] ?? "").trim() : "";
    result.entries.push({ employeeId, date, status, ...(checkIn ? { checkIn } : {}), ...(checkOut ? { checkOut } : {}) });
  }
  return result;
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** A ready-to-fill sheet: one row per employee per day that can take attendance, status left blank. */
export function buildBackfillTemplate(rows: Array<{ employeeId: string; name: string; date: DateKey }>): string {
  return [CSV_HEADER, ...rows.map((r) => [r.employeeId, csvCell(r.name), r.date, "", "", ""].join(","))].join("\n") + "\n";
}

export const eachDayBetween = (start: DateKey, end: DateKey): DateKey[] => {
  const days: DateKey[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
};
