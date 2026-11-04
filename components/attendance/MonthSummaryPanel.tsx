import type { ReactNode } from "react";
import { StatusBreakdown, type DistributionDatum } from "@/components/dashboard/AttendanceChart";
import type { MonthlyAttendanceSummary } from "@/lib/attendance-utils";
import { formatMonthYear, formatUnits } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MonthSummaryPanelProps {
  summary: MonthlyAttendanceSummary;
  /** Extra facts shown under the breakdown, e.g. the month's holidays. */
  facts?: Array<{ label: string; value: ReactNode }>;
  footer?: ReactNode;
  className?: string;
}

export function summaryToDistribution(summary: MonthlyAttendanceSummary): DistributionDatum[] {
  return [
    { status: "approved", count: summary.approvedFullDays + summary.approvedHalfDays },
    { status: "absent", count: summary.absentDays },
    { status: "pending", count: summary.pendingDays },
    { status: "rejected", count: summary.rejectedDays },
    { status: "incomplete", count: summary.incompleteDays },
  ];
}

/** Month progress as a meter plus a status breakdown: the figures sit beside the colors, so nothing needs hover. */
export function MonthSummaryPanel({ summary, facts, footer, className }: MonthSummaryPanelProps) {
  const scheduled = Math.max(1, summary.scheduledWorkingDays);
  const progress = Math.min(100, (summary.approvedDays / scheduled) * 100);

  return (
    <section className={cn("rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10", className)}>
      <h2 className="text-base font-semibold text-foreground">This month</h2>
      <p className="text-sm text-muted-foreground">{formatMonthYear(summary.year, summary.month)}</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-foreground">Approved days</span>
          <span className="text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">{formatUnits(summary.approvedDays)}</span> of{" "}
            {summary.scheduledWorkingDays} scheduled
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-accent"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={summary.scheduledWorkingDays}
          aria-valuenow={Math.min(summary.approvedDays, summary.scheduledWorkingDays)}
          aria-label="Approved days against scheduled working days"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-5 border-t pt-5">
        <StatusBreakdown data={summaryToDistribution(summary)} />
      </div>

      {facts && facts.length > 0 && (
        <dl className="mt-5 space-y-2 border-t pt-5 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="text-right font-medium text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {footer && <div className="mt-5">{footer}</div>}
    </section>
  );
}
