"use client";

import { CalendarDays, CircleX, Hourglass, Timer, TriangleAlert, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { AttendanceCalendar } from "@/components/attendance/AttendanceCalendar";
import { AttendanceDetailsSheet } from "@/components/attendance/AttendanceDetailsSheet";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { computeCompOffBalance } from "@/lib/comp-off";
import { MonthSummaryPanel } from "@/components/attendance/MonthSummaryPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { MonthYearPicker } from "@/components/shared/MonthYearPicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/LoadingState";
import { FilterSelect, SearchFilters, SearchInput } from "@/components/shared/SearchFilters";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/hooks/use-app-data";
import { usePagination } from "@/hooks/use-pagination";
import type { DayEntry } from "@/lib/attendance-utils";
import { compareMonths, monthOf } from "@/lib/date-utils";
import {
  formatDate,
  formatDuration,
  formatMonthYear,
  formatUnits,
  formatWeekday,
  pluralize,
} from "@/lib/format";
import { getDataWindowStart } from "@/lib/selectors/context";
import { selectEmployeeMonth } from "@/lib/selectors/employee";
import { ATTENDANCE_STATUS_META } from "@/lib/status-config";
import type { MonthRef } from "@/types/common";

const PAGE_SIZE = 10;

type StatusFilter =
  | "all"
  | "approved"
  | "pending"
  | "rejected"
  | "absent"
  | "half_day"
  | "holiday"
  | "weekly_off"
  | "incomplete";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half Day" },
  { value: "holiday", label: "Holiday" },
  { value: "weekly_off", label: "Weekly Off" },
  { value: "incomplete", label: "Incomplete" },
];

function matchesStatus(entry: DayEntry, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "approved":
    case "pending":
    case "rejected":
      return entry.approvalStatus === filter;
    default:
      return entry.attendanceStatus === filter;
  }
}

function searchText(entry: DayEntry): string {
  return [
    formatDate(entry.date),
    formatDate(entry.date, "long"),
    formatWeekday(entry.date, "long"),
    ATTENDANCE_STATUS_META[entry.attendanceStatus].label,
    entry.approvalStatus,
    entry.holidayName,
    entry.record?.remarks,
    entry.record?.rejectionReason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function EmployeeAttendanceView() {
  const { db, ctx, employee, today } = useAppData();
  const current = monthOf(today);
  const [period, setPeriod] = useState<MonthRef>(current);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const earliest = useMemo(() => {
    const window = getDataWindowStart(db);
    const joined = monthOf(employee.joiningDate);
    return compareMonths(joined, window) > 0 ? joined : window;
  }, [db, employee.joiningDate]);

  // The picker is bounded, but a data reset could still leave the chosen month out of range.
  const activePeriod =
    compareMonths(period, current) > 0 ? current : compareMonths(period, earliest) < 0 ? earliest : period;

  const view = useMemo(
    () => selectEmployeeMonth(db, ctx, employee.id, activePeriod.year, activePeriod.month),
    [db, ctx, employee.id, activePeriod.year, activePeriod.month],
  );

  const rows = useMemo(() => {
    if (!view) return [];
    const query = search.trim().toLowerCase();
    return view.timeline
      .filter((entry) => entry.isEmployed && !entry.isFuture)
      .reverse()
      .filter((entry) => matchesStatus(entry, status) && (!query || searchText(entry).includes(query)));
  }, [view, search, status]);

  const pagination = usePagination(rows, PAGE_SIZE);

  if (!view) return <PageSkeleton />;

  const { summary, timeline } = view;
  const holidays = timeline.filter((entry) => entry.kind === "holiday");
  const filtersActive = search.trim() !== "" || status !== "all";
  const selected = timeline.find((entry) => entry.date === selectedDate) ?? null;

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    pagination.setPage(1);
  };
  const openDetails = (entry: DayEntry) => {
    setSelectedDate(entry.date);
    setSheetOpen(true);
  };

  const compOff = employee
    ? computeCompOffBalance(Object.values(db.attendance).filter((a) => a.employeeId === employee.id), ctx.holidays)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description={`Your calendar and daily records. Every day with a check-in waits for an administrator's approval.${compOff && (compOff.earned > 0 || compOff.taken > 0) ? ` Comp-off balance: ${compOff.balance} day${compOff.balance === 1 ? "" : "s"} (earned ${compOff.earned}, taken ${compOff.taken}).` : ""}`}
        actions={
          <MonthYearPicker
            value={activePeriod}
            onChange={(next) => {
              setPeriod(next);
              pagination.setPage(1);
            }}
            min={earliest}
            max={current}
          />
        }
      />

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
        <StatCard
          label="Rejected"
          value={summary.rejectedDays}
          hint={summary.rejectedDays ? "Check the reason in details" : "None this month"}
          icon={CircleX}
          tone="red"
        />
        <StatCard
          label="Absent Days"
          value={summary.absentDays}
          hint="No check-in recorded"
          icon={UserX}
          tone="slate"
        />
        <StatCard
          label="Incomplete"
          value={summary.incompleteDays}
          hint="Missing check-out"
          icon={TriangleAlert}
          tone="yellow"
        />
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
            {formatMonthYear(activePeriod.year, activePeriod.month)}
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

      <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <header className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Attendance records</h2>
            <p className="text-sm text-muted-foreground">
              {pluralize(rows.length, "record")} in {formatMonthYear(activePeriod.year, activePeriod.month)}
              {filtersActive ? " match your filters" : ""}
            </p>
          </div>
          <SearchFilters active={filtersActive} onClear={clearFilters}>
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                pagination.setPage(1);
              }}
              placeholder="Search by date, remarks or status"
              className="w-full sm:w-72"
            />
            <FilterSelect
              ariaLabel="Filter by status"
              value={status}
              onValueChange={(value) => {
                setStatus(value as StatusFilter);
                pagination.setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
          </SearchFilters>
        </header>

        {rows.length === 0 ? (
          <div className="border-t">
            <EmptyState
              title="No records match these filters"
              description="Try a different status, clear the search, or pick another month."
              action={
                filtersActive ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="border-t">
              <AttendanceTable entries={pagination.pageItems} onSelect={openDetails} />
            </div>
            <DataTablePagination pagination={pagination} noun="records" />
          </>
        )}
      </section>

      <AttendanceDetailsSheet entry={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
