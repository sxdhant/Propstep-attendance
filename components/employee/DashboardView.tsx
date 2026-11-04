"use client";

import { CalendarCheck, CalendarDays, Clock, Hourglass, Timer, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AttendanceDetailsSheet } from "@/components/attendance/AttendanceDetailsSheet";
import { ApprovalStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { CheckInCard } from "@/components/attendance/CheckInCard";
import { MonthSummaryPanel } from "@/components/attendance/MonthSummaryPanel";
import { RecentAttendance } from "@/components/attendance/RecentAttendance";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { HoursChart, type HoursDatum } from "@/components/dashboard/HoursChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { NotificationItem } from "@/components/layout/NotificationBell";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAppData } from "@/hooks/use-app-data";
import type { DayEntry } from "@/lib/attendance-utils";
import { getIstParts, monthOf } from "@/lib/date-utils";
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatTime,
  formatUnits,
  formatWeekday,
  getFirstName,
  greetingFor,
  pluralize,
} from "@/lib/format";
import {
  selectEmployeeMonth,
  selectNotifications,
  selectRecentEntries,
  selectToday,
} from "@/lib/selectors/employee";
import { markNotificationRead } from "@/lib/services/notification-service";
import { ATTENDANCE_STATUS_META, type Tone } from "@/lib/status-config";
import type { AppNotification } from "@/types/notification";
import { useRouter } from "next/navigation";

interface TodayCard {
  value: string;
  hint: string;
  tone: Tone;
}

export function EmployeeDashboardView() {
  const { db, ctx, employee, today, nowMs } = useAppData();
  const router = useRouter();
  const { year, month } = monthOf(today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const monthView = useMemo(
    () => selectEmployeeMonth(db, ctx, employee.id, year, month),
    [db, ctx, employee.id, year, month],
  );
  const todayView = useMemo(() => selectToday(db, ctx, employee.id), [db, ctx, employee.id]);
  const recent = useMemo(() => selectRecentEntries(db, ctx, employee.id), [db, ctx, employee.id]);
  const notifications = useMemo(() => selectNotifications(db, employee.id).slice(0, 3), [db, employee.id]);

  if (!monthView || !todayView) return <PageSkeleton />;

  const { summary, salary, timeline } = monthView;
  const policy = db.settings.attendance;
  const greeting = greetingFor(Number(getIstParts(new Date(nowMs)).hour));
  const record = todayView.entry.record;

  const todayCard: TodayCard = (() => {
    switch (todayView.state) {
      case "checked_in":
        return { value: formatTime(record?.checkIn), hint: "Checked in, waiting for approval", tone: "blue" };
      case "checked_out":
        return {
          value: formatDuration(record?.workedMinutes),
          hint: `Checked out at ${formatTime(record?.checkOut)}`,
          tone: "slate",
        };
      case "non_working_day":
        return {
          value: "Day off",
          hint: todayView.entry.holidayName ?? "Weekly off",
          tone: "violet",
        };
      case "inactive_account":
        return { value: "Inactive", hint: "This account is deactivated", tone: "gray" };
      default:
        return { value: "Not yet", hint: "You haven't checked in today", tone: "gray" };
    }
  })();

  const pendingRequests = timeline.filter((entry) => entry.approvalStatus === "pending").length;
  const daysWithHours = timeline.filter(
    (entry) => entry.record && entry.record.approval !== "rejected" && (entry.record.workedMinutes ?? 0) > 0,
  ).length;

  const hoursData: HoursDatum[] = recent
    .filter((entry) => (entry.record?.workedMinutes ?? 0) > 0)
    .slice(0, 10)
    .reverse()
    .map((entry) => ({
      label: formatDate(entry.date, "short"),
      title: `${formatWeekday(entry.date, "long")}, ${formatDate(entry.date)}`,
      hours: Number(((entry.record?.workedMinutes ?? 0) / 60).toFixed(2)),
    }));

  // Looked up from live data so the drawer never shows a stale copy of the day.
  const selected = recent.find((entry) => entry.date === selectedDate) ?? null;
  const openDetails = (entry: DayEntry) => {
    setSelectedDate(entry.date);
    setSheetOpen(true);
  };

  const openNotification = (notification: AppNotification) => {
    void markNotificationRead(notification.id);
    if (notification.href) router.push(notification.href);
  };

  const todayStatus = todayView.entry.attendanceStatus;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${getFirstName(employee.fullName)}`}
        description={formatDate(today, "long")}
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Today
            <StatusBadge
              meta={
                todayView.state === "checked_in" || todayView.state === "checked_out"
                  ? ATTENDANCE_STATUS_META[todayStatus]
                  : ATTENDANCE_STATUS_META[
                      todayView.state === "non_working_day" ? todayStatus : "not_checked_in"
                    ]
              }
            />
            {(todayView.state === "checked_in" || todayView.state === "checked_out") && (
              <ApprovalStatusBadge status={record?.approval ?? "pending"} />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Today's Attendance"
          value={todayCard.value}
          hint={todayCard.hint}
          icon={CalendarCheck}
          tone={todayCard.tone}
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          label="Total Approved Days This Month"
          value={formatUnits(summary.approvedDays)}
          hint={`${summary.approvedFullDays} full, ${summary.approvedHalfDays} half, of ${summary.scheduledWorkingDays} scheduled`}
          icon={CalendarDays}
          tone="green"
        />
        <StatCard
          label="Pending Approval Requests"
          value={pendingRequests}
          hint={pendingRequests > 0 ? "Waiting for an administrator" : "Nothing waiting"}
          icon={Hourglass}
          tone={pendingRequests > 0 ? "orange" : "gray"}
          href="/employee/attendance"
        />
        <StatCard
          label="Total Hours Worked This Month"
          value={formatDuration(summary.workedMinutes)}
          hint={`Across ${pluralize(daysWithHours, "day")}`}
          icon={Timer}
          tone="blue"
        />
        <StatCard
          label="Estimated Monthly Salary"
          value={formatCurrency(salary.estimatedSalary)}
          hint="From approved days so far. An estimate until payroll is finalized."
          icon={Wallet}
          tone="blue"
          href="/employee/salary"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <CheckInCard />

      <div className="grid gap-6 xl:grid-cols-3">
        <RecentAttendance entries={recent.slice(0, 7)} onSelect={openDetails} className="xl:col-span-2" />
        <MonthSummaryPanel
          summary={summary}
          facts={[
            { label: "Holidays", value: summary.holidayCount },
            { label: "Weekly offs", value: summary.weeklyOffCount },
            { label: "Late arrivals", value: summary.lateArrivals },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Hours worked"
          description={`Your last ${hoursData.length} days against the ${policy.requiredWorkingHours}-hour requirement`}
          empty={
            hoursData.length === 0
              ? { title: "No hours recorded yet", description: "Check in and out to see your working hours here." }
              : null
          }
          table={{
            columns: [
              { key: "day", label: "Day" },
              { key: "hours", label: "Hours worked", align: "right" },
            ],
            rows: hoursData.map((d) => ({ day: d.title, hours: `${d.hours.toFixed(1)} h` })),
          }}
        >
          <HoursChart data={hoursData} requiredHours={policy.requiredWorkingHours} />
        </ChartCard>

        <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 className="text-base font-semibold text-foreground">Latest notifications</h2>
            <Link
              href="/employee/notifications"
              className="rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              View all
            </Link>
          </header>
          {notifications.length === 0 ? (
            <p className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
              <Clock className="size-4" aria-hidden />
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <NotificationItem notification={notification} nowMs={nowMs} onSelect={openNotification} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AttendanceDetailsSheet entry={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
