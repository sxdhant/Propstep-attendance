"use client";

import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { FilterSelect } from "@/components/shared/SearchFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthEnd, monthOf, monthStart, shiftMonth } from "@/lib/date-utils";
import type { ReportFilters } from "@/lib/selectors/reports";
import type { DateKey } from "@/types/common";
import type { Employee } from "@/types/employee";

interface ReportFilterBarProps {
  value: ReportFilters;
  onChange: (next: ReportFilters) => void;
  onReset: () => void;
  isDefault: boolean;
  employees: Employee[];
  departments: string[];
  /** Earliest date with data. */
  minDate: DateKey;
  today: DateKey;
}

function Labelled({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

const ATTENDANCE_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half Day" },
  { value: "incomplete", label: "Incomplete" },
  { value: "holiday", label: "Holiday" },
  { value: "weekly_off", label: "Weekly Off" },
];

const PAYROLL_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "not_generated", label: "Not Generated" },
  { value: "draft", label: "Draft" },
  { value: "finalized", label: "Finalized" },
  { value: "paid", label: "Paid" },
];

/**
 * One filter row above everything it scopes: every chart, figure, table and
 * CSV export below reads from these same values.
 */
export function ReportFilterBar({
  value,
  onChange,
  onReset,
  isDefault,
  employees,
  departments,
  minDate,
  today,
}: ReportFilterBarProps) {
  const set = (patch: Partial<ReportFilters>) => onChange({ ...value, ...patch });
  const invalidRange = value.start > value.end;

  const presets: Array<{ label: string; start: DateKey; end: DateKey }> = (() => {
    const current = monthOf(today);
    const last = shiftMonth(current, -1);
    const threeBack = shiftMonth(current, -2);
    return [
      { label: "This month", start: monthStart(current.year, current.month), end: today },
      { label: "Last month", start: monthStart(last.year, last.month), end: monthEnd(last.year, last.month) },
      { label: "Last 3 months", start: monthStart(threeBack.year, threeBack.month), end: today },
    ];
  })();

  return (
    <section aria-label="Report filters" className="rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
        <Labelled label="Date range">
          <div className="inline-flex rounded-lg bg-muted p-0.5" role="group" aria-label="Date range presets">
            {presets.map((preset) => {
              const selected = value.start === preset.start && value.end === preset.end;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => set({ start: preset.start, end: preset.end })}
                  className={
                    selected
                      ? "h-8 rounded-md bg-card px-3 text-sm font-medium text-foreground shadow-xs ring-1 ring-foreground/10"
                      : "h-8 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </Labelled>

        <Labelled label="Start date" htmlFor="report-start">
          <Input
            id="report-start"
            type="date"
            value={value.start}
            min={minDate}
            max={today}
            onChange={(event) => event.target.value && set({ start: event.target.value })}
            className="h-9 w-40"
            aria-invalid={invalidRange}
          />
        </Labelled>
        <Labelled label="End date" htmlFor="report-end">
          <Input
            id="report-end"
            type="date"
            value={value.end}
            min={minDate}
            max={today}
            onChange={(event) => event.target.value && set({ end: event.target.value })}
            className="h-9 w-40"
            aria-invalid={invalidRange}
          />
        </Labelled>

        <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={isDefault} className="mb-0.5 text-muted-foreground">
          <RotateCcw className="size-3.5" aria-hidden />
          Reset filters
        </Button>
      </div>

      {invalidRange && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          The start date must be on or before the end date.
        </p>
      )}

      <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <Labelled label="Employee">
          <FilterSelect
            ariaLabel="Filter by employee"
            value={value.employeeId}
            onValueChange={(employeeId) => set({ employeeId })}
            options={[
              { value: "all", label: "All employees" },
              ...employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.id})` })),
            ]}
            className="sm:w-full"
          />
        </Labelled>
        <Labelled label="Department">
          <FilterSelect
            ariaLabel="Filter by department"
            value={value.department}
            onValueChange={(department) => set({ department })}
            options={[{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d, label: d }))]}
            className="sm:w-full"
          />
        </Labelled>
        <Labelled label="Attendance status">
          <FilterSelect
            ariaLabel="Filter by attendance status"
            value={value.attendanceStatus}
            onValueChange={(attendanceStatus) =>
              set({ attendanceStatus: attendanceStatus as ReportFilters["attendanceStatus"] })
            }
            options={ATTENDANCE_OPTIONS}
            className="sm:w-full"
          />
        </Labelled>
        <Labelled label="Payroll status">
          <FilterSelect
            ariaLabel="Filter by payroll status"
            value={value.payrollStatus}
            onValueChange={(payrollStatus) => set({ payrollStatus: payrollStatus as ReportFilters["payrollStatus"] })}
            options={PAYROLL_OPTIONS}
            className="sm:w-full"
          />
        </Labelled>
      </div>
    </section>
  );
}
