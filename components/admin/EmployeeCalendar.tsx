"use client";

import { CalendarDays, CircleX, Hourglass, Timer, TriangleAlert, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { AttendanceCalendar } from "@/components/attendance/AttendanceCalendar";
import { AttendanceDetailsSheet } from "@/components/attendance/AttendanceDetailsSheet";
import { MonthSummaryPanel } from "@/components/attendance/MonthSummaryPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { MonthYearPicker } from "@/components/shared/MonthYearPicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useAppData } from "@/hooks/use-app-data";
import type { DayEntry } from "@/lib/attendance-utils";
import { compareMonths, monthOf } from "@/lib/date-utils";
import { formatDate, formatDuration, formatMonthYear, formatUnits } from "@/lib/format";
import { getDataWindowStart } from "@/lib/selectors/context";
import { selectEmployeeMonth } from "@/lib/selectors/employee";
import type { MonthRef } from "@/types/common";

/** An administrator picks one employee and reads their whole month as a calendar. */
export function EmployeeCalendar() {
  const { db, ctx, today } = useAppData();
  const current = monthOf(today);
  const employees = useMemo(() => [...db.employees].sort((a, b) => a.fullName.localeCompare(b.fullName)), [db.employees]);

  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState<MonthRef>(current);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];

  const earliest = useMemo(() => {
    const window = getDataWindowStart(db);
    if (!employee) return window;
    const joined = monthOf(employee.joiningDate);
    return compareMonths(joined, window) > 0 ? joined : window;
  }, [db, employee]);

  const activePeriod =
    compareMonths(period, current) > 0 ? current : compareMonths(period, earliest) < 0 ? earliest : period;

  const view = useMemo(
    () => (employee ? selectEmployeeMonth(db, ctx, employee.id, activePeriod.year, activePeriod.month) : null),
    [db, ctx, employee, activePeriod.year, activePeriod.month],
  );

  if (!employee || !view) {
    return (
      <div className="space-y-6">
        <PageHeader title="Employee calendar" description="One employee's attendance for the month, day by day." />
        <EmptyState title="No employees yet" description="Add an employee and their attendance calendar will appear here." />
      </div>
    );
  }

  const { summary, timeline } = view;
  const holidays = timeline.filter((entry) => entry.kind === "holiday");
  const selected = timeline.find((entry) => entry.date === selectedDate) ?? null;
  const openDetails = (entry: DayEntry) => {
    setSelectedDate(entry.date);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee calendar"
        description="One employee's attendance for the month, day by day. Select a day for the details."
        actions={
          <MonthYearPicker value={activePeriod} onChange={setPeriod} min={earliest} max={current} />
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <label htmlFor="calendar-employee" className="sr-only">
            Employee
          </label>
          <select
            id="calendar-employee"
            value={employee.id}
            onChange={(event) => {
              setEmployeeId(event.target.value);
              setSheetOpen(false);
            }}
            className="h-10 w-full max-w-sm rounded-lg border border-input bg-background px-3 text-sm font-medium"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} ({e.id}){e.status === "inactive" ? ", inactive" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-muted-foreground">
            {employee.designation}, {employee.department}. Joined {formatDate(employee.joiningDate)}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Approved Days"
          value={formatUnits(summary.approvedDays)}
          hint={`${summary.approvedFullDays} full, ${summary.approvedHalfDays} half`}
          icon={CalendarDays}
          tone="green"
        />
        <StatCard
          label="Pending Requests"
          value={timeline.filter((e) => e.approvalStatus === "pending").length}
          hint="Waiting for approval"
          icon={Hourglass}
          tone="orange"
        />
        <StatCard label="Rejected" value={summary.rejectedDays} hint="Days declined" icon={CircleX} tone="red" />
        <StatCard label="Absent Days" value={summary.absentDays} hint="No check-in recorded" icon={UserX} tone="slate" />
        <StatCard label="Incomplete" value={summary.incompleteDays} hint="Missing check-out" icon={TriangleAlert} tone="yellow" />
        <StatCard
          label="Hours Worked"
          value={formatDuration(summary.workedMinutes)}
          hint="Excludes rejected days"
          icon={Timer}
          tone="blue"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
          <h2 className="mb-4 text-base font-semibold text-foreground">
            {employee.fullName}, {formatMonthYear(activePeriod.year, activePeriod.month)}
          </h2>
          <AttendanceCalendar
            timeline={timeline}
            year={activePeriod.year}
            month={activePeriod.month}
            selectedDate={sheetOpen ? selectedDate : null}
            onSelect={openDetails}
          />
        </section>

        <MonthSummaryPanel
          summary={summary}
          facts={[
            { label: "Holidays", value: holidays.length ? holidays.map((h) => `${h.holidayName}, ${formatDate(h.date, "short")}`).join("; ") : "None" },
            { label: "Weekly offs", value: summary.weeklyOffCount },
            { label: "Late arrivals", value: summary.lateArrivals },
          ]}
        />
      </div>

      <AttendanceDetailsSheet entry={selected} employee={employee} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
