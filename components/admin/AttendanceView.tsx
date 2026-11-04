"use client";

import { CircleCheck, CircleX, ClipboardList, Download, Hourglass } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ApprovalCardList } from "@/components/attendance/ApprovalCardList";
import { ApprovalDialog, type ApprovalMode } from "@/components/attendance/ApprovalDialog";
import { ApprovalTable } from "@/components/attendance/ApprovalTable";
import { AttendanceDetailsSheet } from "@/components/attendance/AttendanceDetailsSheet";
import { BackfillView } from "@/components/admin/BackfillView";
import { EmployeeCalendar } from "@/components/admin/EmployeeCalendar";
import { DailyAttendance } from "@/components/admin/DailyAttendance";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { MonthYearPicker } from "@/components/shared/MonthYearPicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterSelect, SearchFilters, SearchInput } from "@/components/shared/SearchFilters";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData } from "@/hooks/use-app-data";
import { usePagination } from "@/hooks/use-pagination";
import { buildDayEntry } from "@/lib/attendance-utils";
import { DEPARTMENTS } from "@/lib/constants";
import { compareMonths, monthOf } from "@/lib/date-utils";
import { buildApprovalCsv, downloadCsv } from "@/lib/export-utils";
import { formatMonthYear, pluralize } from "@/lib/format";
import { getDataWindowStart } from "@/lib/selectors/context";
import { selectApprovalRows, type ApprovalRow } from "@/lib/selectors/admin";
import type { MonthRef } from "@/types/common";

const PAGE_SIZE = 10;

type TabKey = "all" | "pending" | "approved" | "rejected" | "incomplete";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All Records" },
  { key: "pending", label: "Pending Approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "incomplete", label: "Incomplete" },
];

const matchesTab = (row: ApprovalRow, tab: TabKey): boolean => {
  switch (tab) {
    case "all":
      return true;
    case "incomplete":
      return row.record.effectiveStatus === "incomplete";
    default:
      return row.record.approval === tab;
  }
};

function ApprovalsPanel() {
  const { db, ctx, today } = useAppData();
  const current = monthOf(today);
  const [period, setPeriod] = useState<MonthRef>(current);
  const [tab, setTab] = useState<TabKey>("pending");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");

  // Targets are kept by record id so dialogs show the latest data and survive their close animation.
  const [approval, setApproval] = useState<{ recordId: string | null; mode: ApprovalMode; open: boolean }>({
    recordId: null,
    mode: "approve",
    open: false,
  });
  const [details, setDetails] = useState<{ recordId: string | null; open: boolean }>({ recordId: null, open: false });

  const earliest = useMemo(() => getDataWindowStart(db), [db]);
  const activePeriod =
    compareMonths(period, current) > 0 ? current : compareMonths(period, earliest) < 0 ? earliest : period;

  const monthRows = useMemo(
    () => selectApprovalRows(db, ctx, activePeriod.year, activePeriod.month),
    [db, ctx, activePeriod.year, activePeriod.month],
  );

  // Search and department scope everything below them: the cards, the tab counts and the table.
  const scoped = useMemo(() => {
    const query = search.trim().toLowerCase();
    return monthRows.filter(
      ({ employee }) =>
        (department === "all" || employee.department === department) &&
        (!query || employee.fullName.toLowerCase().includes(query) || employee.id.toLowerCase().includes(query)),
    );
  }, [monthRows, search, department]);

  const counts = useMemo(() => {
    const result: Record<TabKey, number> = { all: scoped.length, pending: 0, approved: 0, rejected: 0, incomplete: 0 };
    for (const row of scoped) {
      if (row.record.approval === "pending") result.pending += 1;
      if (row.record.approval === "approved") result.approved += 1;
      if (row.record.approval === "rejected") result.rejected += 1;
      if (row.record.effectiveStatus === "incomplete") result.incomplete += 1;
    }
    return result;
  }, [scoped]);

  const visible = useMemo(() => scoped.filter((row) => matchesTab(row, tab)), [scoped, tab]);
  const pagination = usePagination(visible, PAGE_SIZE);

  const departments = useMemo(
    () => [...new Set<string>([...DEPARTMENTS, ...db.employees.map((e) => e.department)])].sort(),
    [db.employees],
  );

  const findRow = (recordId: string | null) => monthRows.find((row) => row.record.id === recordId) ?? null;
  const approvalRow = findRow(approval.recordId);
  const detailsRow = findRow(details.recordId);
  const detailsEntry = detailsRow
    ? buildDayEntry(detailsRow.employee, detailsRow.record.date, db.attendance[detailsRow.record.id], ctx)
    : null;

  const filtersActive = search.trim() !== "" || department !== "all";
  const clearFilters = () => {
    setSearch("");
    setDepartment("all");
    pagination.setPage(1);
  };

  const exportCsv = () => {
    downloadCsv(
      `attendance-approvals-${activePeriod.year}-${String(activePeriod.month).padStart(2, "0")}-${tab}.csv`,
      buildApprovalCsv(visible),
    );
    toast.success("Export ready", { description: `${pluralize(visible.length, "record")} saved as CSV.` });
  };

  const openView = (row: ApprovalRow) => setDetails({ recordId: row.record.id, open: true });
  const openApprove = (row: ApprovalRow) => setApproval({ recordId: row.record.id, mode: "approve", open: true });
  const openReject = (row: ApprovalRow) => setApproval({ recordId: row.record.id, mode: "reject", open: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance approvals"
        description="Review every check-in. Approved days count towards payroll, rejected days don't."
        actions={
          <>
            <MonthYearPicker
              value={activePeriod}
              onChange={(next) => {
                setPeriod(next);
                pagination.setPage(1);
              }}
              min={earliest}
              max={current}
            />
            <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Requests"
          value={counts.all}
          hint={formatMonthYear(activePeriod.year, activePeriod.month)}
          icon={ClipboardList}
          tone="blue"
        />
        <StatCard
          label="Pending Requests"
          value={counts.pending}
          hint={counts.pending > 0 ? "Waiting for your decision" : "All reviewed"}
          icon={Hourglass}
          tone={counts.pending > 0 ? "orange" : "gray"}
        />
        <StatCard label="Approved Requests" value={counts.approved} hint="Counted towards payroll" icon={CircleCheck} tone="green" />
        <StatCard label="Rejected Requests" value={counts.rejected} hint="Not counted towards payroll" icon={CircleX} tone="red" />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as TabKey);
          pagination.setPage(1);
        }}
        className="gap-0"
      >
        <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          <header className="space-y-4 p-5">
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList className="h-auto">
                {TABS.map(({ key, label }) => (
                  <TabsTrigger key={key} value={key} className="h-8 flex-none gap-2 px-3">
                    {label}
                    <span className="rounded-full bg-foreground/[0.07] px-1.5 text-xs text-foreground/75 tabular-nums">
                      {counts[key]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <SearchFilters active={filtersActive} onClear={clearFilters}>
              <SearchInput
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  pagination.setPage(1);
                }}
                placeholder="Search by employee name or ID"
                className="w-full sm:w-80"
              />
              <FilterSelect
                ariaLabel="Filter by department"
                value={department}
                onValueChange={(value) => {
                  setDepartment(value);
                  pagination.setPage(1);
                }}
                options={[
                  { value: "all", label: "All departments" },
                  ...departments.map((d) => ({ value: d, label: d })),
                ]}
              />
            </SearchFilters>
          </header>

          {/* One panel serves whichever tab is active, so the selected tab always points at real content. */}
          <TabsContent value={tab}>
            {visible.length === 0 ? (
              <div className="border-t">
                <EmptyState
                  icon={tab === "pending" && !filtersActive ? CircleCheck : ClipboardList}
                  title={
                    tab === "pending" && !filtersActive
                      ? "No attendance is waiting for review"
                      : "No records match these filters"
                  }
                  description={
                    tab === "pending" && !filtersActive
                      ? "New requests appear here as employees check in and out."
                      : "Try another tab, clear the search, or pick a different month."
                  }
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
                  {/* A dense table from tablet width up, one card per request on phones. */}
                  <div className="hidden md:block">
                    <ApprovalTable rows={pagination.pageItems} onView={openView} onApprove={openApprove} onReject={openReject} />
                  </div>
                  <div className="md:hidden">
                    <ApprovalCardList rows={pagination.pageItems} onView={openView} onApprove={openApprove} onReject={openReject} />
                  </div>
                </div>
                <DataTablePagination pagination={pagination} noun="records" />
              </>
            )}
          </TabsContent>
        </section>
      </Tabs>

      <ApprovalDialog
        row={approvalRow}
        mode={approval.mode}
        open={approval.open}
        onOpenChange={(open) => setApproval((state) => ({ ...state, open }))}
      />
      <AttendanceDetailsSheet
        entry={detailsEntry}
        employee={detailsRow?.employee}
        open={details.open}
        onOpenChange={(open) => setDetails((state) => ({ ...state, open }))}
      />
    </div>
  );
}

export function AdminAttendanceView() {
  const [mode, setMode] = useState<"approvals" | "daily" | "calendar" | "backfill">("approvals");
  const options = [
    { key: "approvals", label: "Approvals" },
    { key: "daily", label: "Daily view" },
    { key: "calendar", label: "Employee calendar" },
    { key: "backfill", label: "Add past attendance" },
  ] as const;
  return (
    <div className="space-y-6">
      <div role="group" aria-label="Attendance view" className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {options.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={mode === key ? "default" : "ghost"}
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {mode === "approvals" ? (
        <ApprovalsPanel />
      ) : mode === "calendar" ? (
        <EmployeeCalendar />
      ) : mode === "backfill" ? (
        <BackfillView />
      ) : (
        <>
          <PageHeader title="Daily attendance" description="See every employee's attendance for any single day." />
          <DailyAttendance />
        </>
      )}
    </div>
  );
}
