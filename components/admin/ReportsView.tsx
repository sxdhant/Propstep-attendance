"use client";

import {
  CalendarX2,
  ChartNoAxesColumn,
  CircleCheck,
  Clock,
  Download,
  Gauge,
  Hourglass,
  Timer,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AttendanceTrendChart,
  trendBucketsToData,
} from "@/components/dashboard/AttendanceChart";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  EmployeeStatusChart,
  PAYROLL_LEGEND,
  PayrollMonthChart,
  RankedBars,
} from "@/components/reports/ReportCharts";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { EmployeeSummaryTable, PayrollReportTable, RegisterTable } from "@/components/reports/ReportTables";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData } from "@/hooks/use-app-data";
import { usePagination } from "@/hooks/use-pagination";
import { DEPARTMENTS } from "@/lib/constants";
import { monthOf, monthStart } from "@/lib/date-utils";
import { buildAttendanceCsv, buildPayrollCsv, downloadCsv } from "@/lib/export-utils";
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatHours,
  formatHoursCompact,
  formatMonthYear,
  formatPercent,
  formatUnits,
  pluralize,
} from "@/lib/format";
import { getDataWindowStart } from "@/lib/selectors/context";
import { summarizePayrollRows } from "@/lib/selectors/payroll";
import { selectReport, type ReportFilters } from "@/lib/selectors/reports";
import { CHART_STATUS_META, CHART_STATUS_ORDER } from "@/lib/status-config";

type ReportTab = "attendance" | "hours" | "absences" | "payroll";

const REGISTER_PAGE_SIZE = 10;

export function AdminReportsView() {
  const { db, ctx, today } = useAppData();
  const current = monthOf(today);
  const [tab, setTab] = useState<ReportTab>("attendance");

  const defaults = useMemo<ReportFilters>(
    () => ({
      start: monthStart(current.year, current.month),
      end: today,
      employeeId: "all",
      department: "all",
      attendanceStatus: "all",
      payrollStatus: "all",
    }),
    [current.year, current.month, today],
  );
  const [filters, setFilters] = useState<ReportFilters>(defaults);

  const windowStart = useMemo(() => getDataWindowStart(db), [db]);
  const minDate = monthStart(windowStart.year, windowStart.month);

  const employees = useMemo(
    () => [...db.employees].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    [db.employees],
  );
  const departments = useMemo(
    () => [...new Set<string>([...DEPARTMENTS, ...db.employees.map((e) => e.department)])].sort(),
    [db.employees],
  );

  const report = useMemo(() => selectReport(db, ctx, filters), [db, ctx, filters]);
  const payrollTotals = useMemo(() => summarizePayrollRows(report.payrollRows), [report.payrollRows]);

  const register = useMemo(
    () =>
      [...report.rows].sort(
        (a, b) => b.entry.date.localeCompare(a.entry.date) || a.employee.id.localeCompare(b.employee.id),
      ),
    [report.rows],
  );
  const pagination = usePagination(register, REGISTER_PAGE_SIZE);

  const { summary } = report;
  const decided = summary.approved + summary.pending + summary.rejected + summary.absent + summary.incomplete;
  const attendanceRate = decided ? ((summary.approved + summary.pending) / decided) * 100 : 0;
  const isDefault = JSON.stringify(filters) === JSON.stringify(defaults);
  const rangeLabel = `${formatDate(filters.start)} to ${formatDate(filters.end)}`;

  const updateFilters = (next: ReportFilters) => {
    setFilters(next);
    pagination.setPage(1);
  };

  const trendData = trendBucketsToData(report.trend, report.granularity);
  const statusBars = report.byEmployee.map((b) => ({
    name: b.employee.fullName,
    approved: b.approved,
    absent: b.absent,
    pending: b.pending,
    rejected: b.rejected,
    incomplete: b.incomplete,
  }));
  const hoursRanked = [...report.byEmployee]
    .sort((a, b) => b.minutes - a.minutes)
    .map((b) => ({ name: b.employee.fullName, value: Number((b.minutes / 60).toFixed(1)) }));
  const absencesRanked = [...report.byEmployee]
    .sort((a, b) => b.absent - a.absent)
    .map((b) => ({ name: b.employee.fullName, value: b.absent }));

  const legend = CHART_STATUS_ORDER.map((status) => ({
    label: CHART_STATUS_META[status].label,
    color: CHART_STATUS_META[status].color,
  }));

  const workedDays = report.byEmployee.reduce((sum, b) => sum + b.approved + b.pending + b.rejected + b.incomplete, 0);
  const topHours = hoursRanked[0];
  const repeatAbsentees = report.byEmployee.filter((b) => b.absent >= 3).length;
  const topAbsence = absencesRanked[0];

  const exportAttendance = () => {
    downloadCsv(`attendance-report-${filters.start}-to-${filters.end}.csv`, buildAttendanceCsv(register));
    toast.success("Attendance report exported", {
      description: `${pluralize(register.length, "row")} matching your filters.`,
    });
  };
  const exportPayroll = () => {
    downloadCsv(`payroll-report-${filters.start}-to-${filters.end}.csv`, buildPayrollCsv(report.payrollRows));
    toast.success("Payroll report exported", {
      description: `${pluralize(report.payrollRows.length, "line")} matching your filters.`,
    });
  };

  const noAttendance = report.rows.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Attendance, hours, absences and payroll for any period. Filters apply to every chart, table and export on this page."
        actions={
          <>
            <Button variant="outline" onClick={exportAttendance} disabled={register.length === 0}>
              <Download className="size-4" aria-hidden />
              Export Attendance CSV
            </Button>
            <Button variant="outline" onClick={exportPayroll} disabled={report.payrollRows.length === 0}>
              <Download className="size-4" aria-hidden />
              Export Payroll CSV
            </Button>
          </>
        }
      />

      <ReportFilterBar
        value={filters}
        onChange={updateFilters}
        onReset={() => updateFilters(defaults)}
        isDefault={isDefault}
        employees={employees}
        departments={departments}
        minDate={minDate}
        today={today}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Records" value={summary.totalRecords} hint={rangeLabel} icon={ChartNoAxesColumn} tone="blue" />
        <StatCard
          label="Attendance Rate"
          value={formatPercent(attendanceRate)}
          hint="Approved plus pending"
          icon={Gauge}
          tone="blue"
        />
        <StatCard label="Approved" value={summary.approved} hint="Counted towards payroll" icon={CircleCheck} tone="green" />
        <StatCard label="Pending" value={summary.pending} hint="Waiting for approval" icon={Hourglass} tone="orange" />
        <StatCard label="Absent" value={summary.absent} hint={`${summary.incomplete} incomplete, ${summary.rejected} rejected`} icon={CalendarX2} tone="slate" />
        <StatCard
          label="Hours Worked"
          value={formatHoursCompact(summary.totalMinutes)}
          hint={`${pluralize(summary.lateArrivals, "late arrival")}`}
          icon={Timer}
          tone="blue"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as ReportTab)} className="gap-6">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto">
            {(
              [
                ["attendance", "Attendance"],
                ["hours", "Working Hours"],
                ["absences", "Absences"],
                ["payroll", "Payroll"],
              ] as const
            ).map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="h-8 flex-none px-4">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="attendance" className="space-y-6">
          {noAttendance ? (
            <section className="rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
              <EmptyState
                title="No attendance matches these filters"
                description="Widen the date range or clear a filter to see records."
              />
            </section>
          ) : (
            <>
              <ChartCard
                title="Attendance trend"
                description={
                  report.granularity === "day"
                    ? "Employees by outcome on each day in the range"
                    : "Employee days by outcome, month by month"
                }
                legend={legend}
                table={{
                  columns: [
                    { key: "period", label: report.granularity === "day" ? "Day" : "Month" },
                    ...CHART_STATUS_ORDER.map((status) => ({
                      key: status,
                      label: CHART_STATUS_META[status].label,
                      align: "right" as const,
                    })),
                  ],
                  rows: trendData.map((d) => ({
                    period: d.title,
                    approved: d.approved,
                    absent: d.absent,
                    pending: d.pending,
                    rejected: d.rejected,
                    incomplete: d.incomplete,
                  })),
                }}
              >
                <AttendanceTrendChart
                  data={trendData}
                  ariaLabel={`Stacked columns of attendance outcomes ${report.granularity === "day" ? "per day" : "per month"} from ${rangeLabel}`}
                />
              </ChartCard>

              <ChartCard
                title="Employee-wise attendance"
                description="Days by outcome for each employee in the range"
                legend={legend}
                table={{
                  columns: [
                    { key: "name", label: "Employee" },
                    ...CHART_STATUS_ORDER.map((status) => ({
                      key: status,
                      label: CHART_STATUS_META[status].label,
                      align: "right" as const,
                    })),
                  ],
                  rows: statusBars.map((b) => ({ ...b })),
                }}
              >
                <EmployeeStatusChart data={statusBars} ariaLabel={`Attendance outcomes for each employee from ${rangeLabel}`} />
              </ChartCard>

              <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
                <header className="px-5 pt-5 pb-4">
                  <h2 className="text-base font-semibold text-foreground">Employee summary</h2>
                  <p className="text-sm text-muted-foreground">Totals and attendance rate for each employee</p>
                </header>
                <div className="border-t">
                  <EmployeeSummaryTable rows={report.byEmployee} />
                </div>
              </section>

              <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
                <header className="px-5 pt-5 pb-4">
                  <h2 className="text-base font-semibold text-foreground">Attendance register</h2>
                  <p className="text-sm text-muted-foreground">
                    {pluralize(register.length, "row")}. The same rows are in the attendance CSV export.
                  </p>
                </header>
                <div className="border-t">
                  <RegisterTable rows={pagination.pageItems} />
                </div>
                <DataTablePagination pagination={pagination} noun="rows" />
              </section>
            </>
          )}
        </TabsContent>

        <TabsContent value="hours" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard label="Total Hours Worked" value={formatHoursCompact(summary.totalMinutes)} hint="Excludes rejected days" icon={Timer} tone="blue" />
            <StatCard
              label="Average per Worked Day"
              value={formatDuration(summary.averageMinutesPerRecord)}
              hint={`Across ${pluralize(workedDays, "worked day")}`}
              icon={Clock}
              tone="blue"
            />
            <StatCard
              label="Most Hours"
              value={topHours ? `${topHours.value} h` : "—"}
              hint={topHours?.name ?? "No hours recorded"}
              icon={Gauge}
              tone="green"
            />
          </div>
          <ChartCard
            title="Hours worked by employee"
            description={`Total hours from ${rangeLabel}, excluding rejected days`}
            empty={
              hoursRanked.every((d) => d.value === 0)
                ? { title: "No hours recorded", description: "Hours appear once people check in and out in this range." }
                : null
            }
            table={{
              columns: [
                { key: "name", label: "Employee" },
                { key: "hours", label: "Hours", align: "right" },
                { key: "avg", label: "Average per day", align: "right" },
              ],
              rows: report.byEmployee.map((b) => {
                const days = b.approved + b.pending + b.rejected + b.incomplete;
                return {
                  name: b.employee.fullName,
                  hours: `${formatHours(b.minutes)} h`,
                  avg: formatDuration(days ? b.minutes / days : 0),
                };
              }),
            }}
          >
            <RankedBars
              data={hoursRanked}
              seriesName="Hours worked"
              format={(value) => `${value.toFixed(1)} h`}
              tickFormat={(value) => `${value}h`}
              ariaLabel={`Hours worked by each employee from ${rangeLabel}`}
            />
          </ChartCard>
        </TabsContent>

        <TabsContent value="absences" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard label="Absent Days" value={summary.absentEmployeeDays} hint="No check-in on a working day" icon={CalendarX2} tone="slate" />
            <StatCard
              label="Repeat Absences"
              value={repeatAbsentees}
              hint="Employees absent 3 or more days"
              icon={Hourglass}
              tone={repeatAbsentees > 0 ? "orange" : "gray"}
            />
            <StatCard
              label="Most Absences"
              value={topAbsence && topAbsence.value > 0 ? `${topAbsence.value} days` : "—"}
              hint={topAbsence && topAbsence.value > 0 ? topAbsence.name : "No absences in this range"}
              icon={CalendarX2}
              tone="slate"
            />
          </div>
          <ChartCard
            title="Absent days by employee"
            description={`Working days with no check-in, ${rangeLabel}`}
            empty={
              absencesRanked.every((d) => d.value === 0)
                ? { title: "No absences in this range", description: "Everyone with a working day in range was present." }
                : null
            }
            table={{
              columns: [
                { key: "name", label: "Employee" },
                { key: "absent", label: "Absent", align: "right" },
                { key: "rejected", label: "Rejected", align: "right" },
                { key: "incomplete", label: "Incomplete", align: "right" },
                { key: "late", label: "Late arrivals", align: "right" },
              ],
              rows: report.byEmployee.map((b) => ({
                name: b.employee.fullName,
                absent: b.absent,
                rejected: b.rejected,
                incomplete: b.incomplete,
                late: b.lateArrivals,
              })),
            }}
          >
            <RankedBars
              data={absencesRanked}
              color={CHART_STATUS_META.absent.color}
              seriesName="Absent days"
              format={(value) => `${value} ${value === 1 ? "day" : "days"}`}
              ariaLabel={`Absent days for each employee from ${rangeLabel}`}
            />
          </ChartCard>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard label="Estimated Payroll" value={formatCurrency(payrollTotals.estimated)} hint={`${pluralize(payrollTotals.employees, "line")} in range`} icon={Wallet} tone="blue" />
            <StatCard label="Finalized" value={formatCurrency(payrollTotals.finalized)} hint="Finalized plus paid" icon={CircleCheck} tone="blue" />
            <StatCard label="Paid" value={formatCurrency(payrollTotals.paid)} hint={`${pluralize(payrollTotals.paidCount, "line")} paid`} icon={CircleCheck} tone="green" />
            <StatCard
              label="Unpaid"
              value={formatCurrency(payrollTotals.unpaid)}
              hint={`${pluralize(payrollTotals.unpaidCount, "line")} awaiting payment`}
              icon={Hourglass}
              tone={payrollTotals.unpaidCount > 0 ? "orange" : "gray"}
            />
          </div>

          <ChartCard
            title="Payroll by month"
            description="Salary totals, lightest for draft up to darkest for paid"
            legend={PAYROLL_LEGEND}
            empty={
              report.payrollRows.length === 0
                ? { title: "No payroll in this range", description: "Widen the date range or change the payroll status filter." }
                : null
            }
            table={{
              columns: [
                { key: "month", label: "Month" },
                { key: "not_generated", label: "Not generated", align: "right" },
                { key: "draft", label: "Draft", align: "right" },
                { key: "finalized", label: "Finalized", align: "right" },
                { key: "paid", label: "Paid", align: "right" },
              ],
              rows: report.payrollByMonth.map((m) => ({
                month: formatMonthYear(m.year, m.month),
                not_generated: formatCurrency(m.not_generated),
                draft: formatCurrency(m.draft),
                finalized: formatCurrency(m.finalized),
                paid: formatCurrency(m.paid),
              })),
            }}
          >
            <PayrollMonthChart data={report.payrollByMonth} />
          </ChartCard>

          <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
            <header className="px-5 pt-5 pb-4">
              <h2 className="text-base font-semibold text-foreground">Payroll lines</h2>
              <p className="text-sm text-muted-foreground">
                {pluralize(report.payrollRows.length, "line")}. Payable units use {formatUnits(db.settings.salary.halfDayUnits)} per half day.
              </p>
            </header>
            {report.payrollRows.length === 0 ? (
              <div className="border-t">
                <EmptyState title="No payroll lines" description="Nothing matches these filters." />
              </div>
            ) : (
              <div className="border-t">
                <PayrollReportTable rows={report.payrollRows} />
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
