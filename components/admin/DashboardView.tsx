"use client";

import {
  CalendarX2,
  ClipboardCheck,
  ReceiptIndianRupee,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AttendanceDetailsSheet } from "@/components/attendance/AttendanceDetailsSheet";
import {
  AttendanceTrendChart,
  StatusBreakdown,
  StatusDonutChart,
  trendPointsToData,
} from "@/components/dashboard/AttendanceChart";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatCard } from "@/components/dashboard/StatCard";
import { TodayRosterPanel, type RosterKind } from "@/components/dashboard/TodayRoster";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/hooks/use-app-data";
import { buildDayEntry, type DayEntry } from "@/lib/attendance-utils";
import { formatCurrency, formatDate, formatMonthYear, formatNumber, pluralize } from "@/lib/format";
import { monthOf } from "@/lib/date-utils";
import { selectAdminOverview, selectTodayRoster, type ActivityRow, type RosterRow } from "@/lib/selectors/admin";
import { CHART_STATUS_META, CHART_STATUS_ORDER } from "@/lib/status-config";
import type { Employee } from "@/types/employee";

export function AdminDashboardView() {
  const { db, ctx, admin, today, nowMs } = useAppData();
  const { year, month } = monthOf(today);
  const [selected, setSelected] = useState<{ entry: DayEntry; employee: Employee } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const overview = useMemo(() => selectAdminOverview(db, ctx), [db, ctx]);
  const roster = useMemo(() => selectTodayRoster(db, ctx), [db, ctx]);

  // Which stat card is expanded (clicking it again, or the close button, collapses it).
  const [openCard, setOpenCard] = useState<RosterKind | null>(null);
  const toggleCard = (kind: RosterKind) => setOpenCard((current) => (current === kind ? null : kind));
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (openCard) panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [openCard]);
  useEffect(() => {
    if (!openCard) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenCard(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCard]);

  const openRoster = (row: RosterRow) => {
    setSelected({
      entry: buildDayEntry(row.employee, ctx.today, db.attendance[`${row.employee.id}_${ctx.today}`], ctx),
      employee: row.employee,
    });
    setSheetOpen(true);
  };

  const trendData = useMemo(() => trendPointsToData(overview.trend), [overview.trend]);
  const totalRecords = overview.distribution.reduce((sum, item) => sum + item.count, 0);
  const legend = CHART_STATUS_ORDER.map((status) => ({
    label: CHART_STATUS_META[status].label,
    color: CHART_STATUS_META[status].color,
  }));

  const openDetails = (row: ActivityRow) => {
    const record = db.attendance[row.record.id];
    setSelected({ entry: buildDayEntry(row.employee, row.record.date, record, ctx), employee: row.employee });
    setSheetOpen(true);
  };

  const presentHint = overview.isWorkingDayToday
    ? overview.awaitingApprovalToday > 0
      ? `of ${overview.expectedToday} expected, ${overview.awaitingApprovalToday} awaiting approval`
      : `of ${overview.expectedToday} expected today`
    : (overview.holidayToday ?? "Weekly off today");
  const absentHint = !overview.isWorkingDayToday
    ? "No attendance expected today"
    : overview.absentToday > 0
      ? `Not checked in or on leave`
      : `Counted after ${overview.absentCutoff} plus grace`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${admin.fullName.split(" ")[0]}`}
        description={`Company overview for ${formatDate(today, "long")}`}
        actions={
          <Button asChild>
            <Link href="/admin/attendance">
              <ClipboardCheck className="size-4" aria-hidden />
              Review approvals
              {overview.pendingApprovals > 0 && (
                <span className="ml-0.5 rounded-full bg-white px-1.5 text-xs font-semibold text-primary tabular-nums">
                  {overview.pendingApprovals}
                </span>
              )}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total Employees"
          value={overview.activeEmployees}
          hint={
            overview.inactiveEmployees > 0
              ? `Active, plus ${overview.inactiveEmployees} inactive`
              : "All accounts are active"
          }
          icon={Users}
          tone="blue"
          onToggle={() => toggleCard("total")}
          expanded={openCard === "total"}
          controls="today-roster"
          toggleLabel="names"
        />
        <StatCard
          label="Present Today"
          value={overview.presentToday}
          hint={presentHint}
          icon={UserCheck}
          tone="green"
          onToggle={() => toggleCard("present")}
          expanded={openCard === "present"}
          controls="today-roster"
          toggleLabel="names"
        />
        <StatCard
          label="Pending Approvals"
          value={overview.pendingApprovals}
          hint={overview.pendingApprovals > 0 ? "Waiting for your decision" : "Nothing waiting"}
          icon={ClipboardCheck}
          tone={overview.pendingApprovals > 0 ? "orange" : "gray"}
          href="/admin/attendance"
        />
        <StatCard
          label="Absent Today"
          value={overview.absentToday}
          hint={absentHint}
          icon={CalendarX2}
          tone="slate"
          onToggle={() => toggleCard("absent")}
          expanded={openCard === "absent"}
          controls="today-roster"
          toggleLabel="names"
        />
        <StatCard
          label="Incomplete Attendance"
          value={overview.incompleteAttendance}
          hint={overview.incompleteAttendance > 0 ? "Need regularizing" : "Nothing to fix"}
          icon={TriangleAlert}
          tone="yellow"
          href="/admin/attendance"
        />
        <StatCard
          label="Estimated Monthly Payroll"
          value={formatCurrency(overview.payroll.estimated)}
          hint={`${formatMonthYear(year, month)}, from approved days so far`}
          icon={ReceiptIndianRupee}
          tone="blue"
          href="/admin/payroll"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {openCard && (
        <div ref={panelRef} className="scroll-mt-20">
          <TodayRosterPanel
            id="today-roster"
            kind={openCard}
            roster={roster}
            onClose={() => setOpenCard(null)}
            onSelect={openRoster}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Attendance this month"
          description={`Employees by outcome on each working day of ${formatMonthYear(year, month)}`}
          legend={legend}
          empty={
            trendData.length === 0
              ? { title: "No attendance yet this month", description: "Daily outcomes appear as soon as people check in." }
              : null
          }
          table={{
            columns: [
              { key: "day", label: "Day" },
              ...CHART_STATUS_ORDER.map((status) => ({
                key: status,
                label: CHART_STATUS_META[status].label,
                align: "right" as const,
              })),
            ],
            rows: trendData.map((d) => ({
              day: d.title,
              approved: d.approved,
              absent: d.absent,
              pending: d.pending,
              rejected: d.rejected,
              incomplete: d.incomplete,
            })),
          }}
        >
          <AttendanceTrendChart
            height={340}
            data={trendData}
            ariaLabel={`Stacked columns of employees by attendance outcome for each working day of ${formatMonthYear(year, month)}`}
          />
        </ChartCard>

        <ChartCard
          title="Attendance by status"
          description={`${pluralize(totalRecords, "employee day")} this month`}
          empty={
            totalRecords === 0
              ? { title: "Nothing to show yet", description: "The breakdown appears once attendance is recorded." }
              : null
          }
          table={{
            columns: [
              { key: "status", label: "Status" },
              { key: "count", label: "Employee days", align: "right" },
              { key: "share", label: "Share", align: "right" },
            ],
            rows: overview.distribution.map((d) => ({
              status: CHART_STATUS_META[d.status].label,
              count: formatNumber(d.count),
              share: `${totalRecords ? ((d.count / totalRecords) * 100).toFixed(0) : 0}%`,
            })),
          }}
        >
          <div className="flex flex-col items-center gap-6">
            <StatusDonutChart data={overview.distribution} centerLabel="employee days" />
            <StatusBreakdown data={overview.distribution} />
          </div>
        </ChartCard>
      </div>

      <RecentActivity rows={overview.recentActivity} nowMs={nowMs} onSelect={openDetails} />

      <AttendanceDetailsSheet
        entry={selected?.entry ?? null}
        employee={selected?.employee}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
