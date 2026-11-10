"use client";

import { CircleAlert, CircleCheck, Download, FileUp, Info, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Spinner } from "@/components/shared/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/hooks/use-app-data";
import { buildDayEntry } from "@/lib/attendance-utils";
import {
  BACKFILL_ALLOWED_MONTHS,
  BACKFILL_REMARK,
  buildBackfillTemplate,
  parseBackfillCsv,
  type BackfillEntry,
  type BackfillStatus,
} from "@/lib/backfill";
import { eachDayOfMonth, getIstParts } from "@/lib/date-utils";
import { downloadCsv } from "@/lib/export-utils";
import { formatDate, formatMonthYear, formatWeekday, pluralize } from "@/lib/format";
import { isPayrollLocked, payrollId } from "@/lib/payroll-utils";
import {
  previewBackfill,
  saveBackfill,
  type BackfillPreview,
  type BackfillRowResult,
} from "@/lib/services/attendance-service";
import { cn } from "@/lib/utils";
import type { DateKey } from "@/types/common";
import type { Employee } from "@/types/employee";

/* ------------------------------- shared bits ------------------------------- */

const STATUS_LABEL: Record<BackfillStatus, string> = { present: "Present", half_day: "Half day", absent: "Absent", week_off: "Week off" };
const toClock = (iso: string) => {
  const p = getIstParts(new Date(iso));
  return `${p.hour}:${p.minute}`;
};

/** Employees who were employed at some point in the month. */
function employeesInMonth(employees: Employee[], year: number, month: number): Employee[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = `${year}-${String(month).padStart(2, "0")}-31`;
  return employees
    .filter((e) => e.joiningDate <= last && (!e.deactivatedOn || e.deactivatedOn >= first))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

const monthOptions = BACKFILL_ALLOWED_MONTHS.map((key) => ({ key, year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) }));

/* ---------------------------------- grid ---------------------------------- */

type Cell = { status: BackfillStatus | ""; checkIn: string; checkOut: string };

function MonthGrid({ employee, year, month, onSaved }: { employee: Employee; year: number; month: number; onSaved: () => void }) {
  const { db, ctx } = useAppData();
  const { policy } = ctx;
  const dates = useMemo(() => eachDayOfMonth(year, month), [year, month]);
  const locked = isPayrollLocked(db.payroll[payrollId(employee.id, year, month)]);

  // What each day looks like right now, and what a person can do with it.
  const days = useMemo(
    () =>
      dates.map((date) => {
        const record = db.attendance[`${employee.id}_${date}`];
        const entry = buildDayEntry(employee, date, record, ctx);
        const real = Boolean(record) && record.remarks !== BACKFILL_REMARK;
        const personalOff = record?.status === "week_off" && record.remarks === BACKFILL_REMARK;
        let blocked: string | null = null;
        if (personalOff && entry.isEmployed && !locked) blocked = null;
        else if (!entry.isEmployed) blocked = "Not employed";
        else if (entry.kind === "holiday") blocked = entry.holidayName ?? "Holiday";
        else if (entry.kind === "weekly_off") blocked = "Weekly off";
        else if (entry.isFuture || entry.isToday) blocked = "Not yet";
        else if (real) blocked = "Recorded by check-in";
        else if (locked) blocked = "Payroll finalized";
        return { date, blocked, record };
      }),
    [dates, db.attendance, employee, ctx, locked],
  );

  const initial = useMemo(() => {
    const map: Record<DateKey, Cell> = {};
    for (const { date, blocked, record } of days) {
      if (blocked || !record || record.remarks !== BACKFILL_REMARK) map[date] = { status: "", checkIn: "", checkOut: "" };
      else
        map[date] = {
          status: record.status === "half_day" ? "half_day" : record.status === "week_off" ? "week_off" : "present",
          checkIn: record.checkIn ? toClock(record.checkIn) : "",
          checkOut: record.checkOut ? toClock(record.checkOut) : "",
        };
    }
    return map;
  }, [days]);

  const [cells, setCells] = useState<Record<DateKey, Cell>>(initial);
  const [rowErrors, setRowErrors] = useState<Record<DateKey, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (date: DateKey, patch: Partial<Cell>) => setCells((c) => ({ ...c, [date]: { ...c[date], ...patch } }));
  const dirtyDates = dates.filter((d) => {
    const a = cells[d];
    const b = initial[d];
    return a.status !== b.status || a.checkIn !== b.checkIn || a.checkOut !== b.checkOut;
  });

  const editable = days.filter((d) => !d.blocked);
  const counts = { present: 0, half_day: 0, absent: 0, week_off: 0 };
  for (const { date, blocked } of days) {
    const s = cells[date]?.status;
    if (!blocked && s) counts[s]++;
  }

  const markAllPresent = () =>
    setCells((c) => {
      const next = { ...c };
      for (const { date } of editable) if (!next[date].status) next[date] = { ...next[date], status: "present" };
      return next;
    });

  const save = async () => {
    const entries: BackfillEntry[] = dirtyDates.map((date) => {
      const c = cells[date];
      const status: BackfillStatus = c.status || "absent"; // a day that had a saved status and was cleared
      return {
        employeeId: employee.id,
        date,
        status,
        ...(status !== "absent" && status !== "week_off" && c.checkIn ? { checkIn: c.checkIn } : {}),
        ...(status !== "absent" && status !== "week_off" && c.checkOut ? { checkOut: c.checkOut } : {}),
      };
    });
    setSaving(true);
    setRowErrors({});
    const check = await previewBackfill(entries);
    if (!check.ok) {
      setSaving(false);
      return toast.error("Couldn't check the entries", { description: check.error });
    }
    if (check.data.summary.errors > 0) {
      setSaving(false);
      const errors: Record<DateKey, string> = {};
      for (const r of check.data.results) if (!r.ok && r.error) errors[r.date] = r.error;
      setRowErrors(errors);
      return toast.error("Some days can't be saved", { description: "Fix the highlighted rows and try again. Nothing was saved." });
    }
    const result = await saveBackfill(entries);
    setSaving(false);
    if (!result.ok) return toast.error("Couldn't save", { description: result.error });
    toast.success(`Saved ${employee.fullName}'s ${formatMonthYear(year, month)} attendance`, {
      description: `${pluralize(result.data.created + result.data.updated, "day")} saved${result.data.cleared ? `, ${result.data.cleared} cleared` : ""}. Days are approved automatically.`,
    });
    onSaved();
  };

  return (
    <div className="space-y-4">
      {locked && (
        <Alert>
          <Info aria-hidden />
          <AlertTitle>Payroll for {formatMonthYear(year, month)} is finalized</AlertTitle>
          <AlertDescription>Attendance for this month can no longer be changed.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={markAllPresent} disabled={locked || editable.length === 0}>
          Mark all working days Present
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setCells(initial); setRowErrors({}); }} disabled={dirtyDates.length === 0}>
          Undo changes
        </Button>
        <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
          {counts.present} present, {counts.half_day} half day, {counts.absent} absent{counts.week_off > 0 ? `, ${counts.week_off} week off` : ""}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Attendance</th>
              <th className="px-4 py-2.5 font-medium">Check-in</th>
              <th className="px-4 py-2.5 font-medium">Check-out</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {days.map(({ date, blocked }) => {
              const c = cells[date];
              const worked = c.status === "present" || c.status === "half_day";
              const error = rowErrors[date];
              return (
                <tr key={date} className={cn(blocked && "bg-muted/30 text-muted-foreground", error && "bg-red-50")}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="font-medium text-foreground">{formatDate(date, "short")}</span>{" "}
                    <span className="text-muted-foreground">{formatWeekday(date)}</span>
                  </td>
                  {blocked ? (
                    <td colSpan={3} className="px-4 py-2 text-xs">{blocked}</td>
                  ) : (
                    <>
                      <td className="px-4 py-2">
                        <select
                          aria-label={`Attendance for ${formatDate(date)}`}
                          value={c.status}
                          onChange={(e) => set(date, { status: e.target.value as Cell["status"] })}
                          disabled={saving}
                          className="h-9 w-36 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                        >
                          {!initial[date].status && <option value="">Not set</option>}
                          {(["present", "half_day", "absent", "week_off"] as const).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <Input type="time" aria-label={`Check-in time for ${formatDate(date)}`} value={c.checkIn} disabled={!worked || saving} onChange={(e) => set(date, { checkIn: e.target.value })} className="h-9 w-32" />
                      </td>
                      <td className="px-4 py-2">
                        <Input type="time" aria-label={`Check-out time for ${formatDate(date)}`} value={c.checkOut} disabled={!worked || saving} onChange={(e) => set(date, { checkOut: e.target.value })} className="h-9 w-32" />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Leave times empty to use office hours ({policy.officeStartTime} to {policy.officeEndTime}; a half day is {policy.halfDayThresholdHours} hours).
          Days with no entry count as absent. Choose Week off for a day an employee takes off: it isn&apos;t an absence and isn&apos;t counted as a working day.
        </p>
        <Button type="button" onClick={save} disabled={dirtyDates.length === 0 || saving || locked}>
          {saving ? <Spinner /> : <Save className="size-4" aria-hidden />}
          Save {dirtyDates.length > 0 ? pluralize(dirtyDates.length, "change") : "changes"}
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------- CSV ----------------------------------- */

function CsvImport({ employees, year, month }: { employees: Employee[]; year: number; month: number }) {
  const { db, ctx } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [parseErrors, setParseErrors] = useState<Array<{ line: number; message: string }>>([]);
  const [entries, setEntries] = useState<BackfillEntry[]>([]);
  const [preview, setPreview] = useState<BackfillPreview | null>(null);

  const downloadTemplate = () => {
    const rows: Array<{ employeeId: string; name: string; date: DateKey }> = [];
    for (const employee of employees) {
      for (const date of eachDayOfMonth(year, month)) {
        const record = db.attendance[`${employee.id}_${date}`];
        const entry = buildDayEntry(employee, date, record, ctx);
        if (entry.isEmployed && entry.kind === "working" && !entry.isFuture && !entry.isToday && !(record && record.remarks !== BACKFILL_REMARK)) {
          rows.push({ employeeId: employee.id, name: employee.fullName, date });
        }
      }
    }
    downloadCsv(`attendance-${year}-${String(month).padStart(2, "0")}-template.csv`, buildBackfillTemplate(rows));
    toast.success("Template downloaded", { description: "Fill the status column with present, half_day, week_off or absent, then upload it here." });
  };

  const check = async (source: string) => {
    setPreview(null);
    const parsed = parseBackfillCsv(source);
    setParseErrors(parsed.errors);
    setEntries(parsed.entries);
    if (parsed.errors.length > 0) return;
    if (parsed.entries.length === 0) {
      return toast.info("Nothing to import", { description: "Every row has an empty status. Fill the status column first." });
    }
    setBusy(true);
    const result = await previewBackfill(parsed.entries);
    setBusy(false);
    if (!result.ok) return toast.error("Couldn't check the file", { description: result.error });
    setPreview(result.data);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText(content);
    await check(content);
  };

  const commit = async () => {
    setBusy(true);
    const result = await saveBackfill(entries);
    setBusy(false);
    if (!result.ok) return toast.error("Nothing was saved", { description: result.error });
    toast.success("Attendance imported", {
      description: `${pluralize(result.data.created + result.data.updated, "day")} saved for ${pluralize(result.data.employees, "employee")}${result.data.cleared ? `, ${result.data.cleared} cleared` : ""}.`,
    });
    setText("");
    setEntries([]);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const failedRows = preview?.results.filter((r) => !r.ok) ?? [];
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.fullName ?? id;

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>
          Download the template. It has one row for every employee and working day in {formatMonthYear(year, month)}.
        </li>
        <li>
          Fill the <span className="font-medium text-foreground">status</span> column with <code>present</code>, <code>half_day</code> or{" "}
          <code>absent</code> (or P, H, A). <span className="font-medium text-foreground">check_in</span> and{" "}
          <span className="font-medium text-foreground">check_out</span> are optional, like <code>09:45</code>. Rows with an empty status are ignored.
        </li>
        <li>Upload it. You see a check of every row before anything is saved.</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={downloadTemplate}>
          <Download className="size-4" aria-hidden /> Download template
        </Button>
        <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          <FileUp className="size-4" aria-hidden /> Upload filled CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Upload attendance CSV" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Or paste CSV text</summary>
        <div className="mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            aria-label="Attendance CSV text"
            placeholder={"employee_id,date,status,check_in,check_out\nEMP-1001,2026-10-14,present,,"}
            className="w-full rounded-md border bg-background p-3 font-mono text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => void check(text)} disabled={busy || !text.trim()}>
            Check pasted text
          </Button>
        </div>
      </details>

      {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Working</p>}

      {parseErrors.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>The file has {pluralize(parseErrors.length, "problem")}. Fix them and upload again.</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5">
              {parseErrors.slice(0, 15).map((e) => (
                <li key={`${e.line}-${e.message}`}>Line {e.line}: {e.message}</li>
              ))}
              {parseErrors.length > 15 && <li>and {parseErrors.length - 15} more.</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {preview && (
        <div className="space-y-3 rounded-xl p-4 ring-1 ring-foreground/10">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            {failedRows.length === 0 ? <CircleCheck className="size-4 text-green-700" aria-hidden /> : <CircleAlert className="size-4 text-destructive" aria-hidden />}
            {preview.summary.rows} rows checked: {preview.summary.toSave} to save, {preview.summary.toClear} to clear, {failedRows.length} with problems
          </p>
          {failedRows.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm text-destructive">
              {failedRows.slice(0, 50).map((r: BackfillRowResult) => (
                <li key={r.index}>
                  {nameOf(r.employeeId)} ({r.employeeId}), {formatDate(r.date)}: {r.error}
                </li>
              ))}
              {failedRows.length > 50 && <li>and {failedRows.length - 50} more.</li>}
            </ul>
          )}
          {failedRows.length > 0 ? (
            <p className="text-sm text-muted-foreground">Nothing can be imported until every row is fixed. Nothing has been saved.</p>
          ) : (
            <Button type="button" onClick={commit} disabled={busy}>
              {busy ? <Spinner /> : <Save className="size-4" aria-hidden />}
              Import {pluralize(preview.summary.rows, "row")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- screen --------------------------------- */

export function BackfillView() {
  const { db } = useAppData();
  const [monthKey, setMonthKey] = useState(monthOptions[0]?.key ?? "");
  const [tab, setTab] = useState<"grid" | "csv">("grid");
  const [employeeId, setEmployeeId] = useState("");
  const [version, setVersion] = useState(0);

  const selected = monthOptions.find((m) => m.key === monthKey);
  const employees = useMemo(() => (selected ? employeesInMonth(db.employees, selected.year, selected.month) : []), [db.employees, selected]);
  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];

  if (!selected) {
    return <EmptyState title="Backfilling is closed" description="No month is currently open for adding past attendance." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add past attendance</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Enter attendance for {formatMonthYear(selected.year, selected.month)}, before the app was in use. Days you enter are approved automatically and
          employees are told once. Weekly offs and holidays can&apos;t take attendance, and a month whose payroll is finalized is locked.
        </p>
      </div>

      {monthOptions.length > 1 && (
        <select aria-label="Month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          {monthOptions.map((m) => (
            <option key={m.key} value={m.key}>{formatMonthYear(m.year, m.month)}</option>
          ))}
        </select>
      )}

      <div role="group" aria-label="How to add attendance" className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {([["grid", "Monthly grid"], ["csv", "CSV import"]] as const).map(([key, label]) => (
          <Button key={key} type="button" size="sm" variant={tab === key ? "default" : "ghost"} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {employees.length === 0 ? (
        <EmptyState title="No employees to add attendance for" description="Add employees first, with the joining date they actually joined on. Attendance can't be added before an employee's joining date." />
      ) : tab === "grid" ? (
        <section className="space-y-4 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="backfill-employee" className="text-sm font-medium text-foreground">Employee</label>
            <select
              id="backfill-employee"
              value={employee?.id ?? ""}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-9 min-w-56 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName} ({e.id})</option>
              ))}
            </select>
            {employee && <p className="text-xs text-muted-foreground">Joined {formatDate(employee.joiningDate)}</p>}
          </div>
          {employee && (
            <MonthGrid key={`${employee.id}-${monthKey}-${version}`} employee={employee} year={selected.year} month={selected.month} onSaved={() => setVersion((v) => v + 1)} />
          )}
        </section>
      ) : (
        <section className="rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
          <CsvImport employees={employees} year={selected.year} month={selected.month} />
        </section>
      )}
    </div>
  );
}
