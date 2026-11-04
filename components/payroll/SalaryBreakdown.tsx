"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DIVISOR_POLICY_LABELS } from "@/lib/salary-calculator";
import { formatCurrency, formatDateTime, formatMonthYear, formatUnits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PayrollRow, PayrollSnapshot } from "@/types/payroll";

/** A label and value joined by a dotted leader, like a line on a payslip. */
function LedgerRow({
  label,
  value,
  note,
  strong = false,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  strong?: boolean;
}) {
  return (
    <div>
      <div className={cn("flex items-baseline gap-2 text-sm", strong && "text-base font-semibold")}>
        <span className={cn(strong ? "text-foreground" : "text-muted-foreground")}>{label}</span>
        <span className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-border" aria-hidden />
        <span className={cn("tabular-nums", strong ? "text-foreground" : "font-medium text-foreground")}>{value}</span>
      </div>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** The salary maths for one snapshot, shown in full so nothing is a black box. */
export function SalaryBreakdownBody({ figures }: { figures: PayrollSnapshot }) {
  const notCounted: Array<[string, number, string]> = [
    ["Pending approval", figures.pendingDays, "Counted once an administrator approves them."],
    ["Rejected", figures.rejectedDays, "Not payable."],
    ["Incomplete", figures.incompleteDays, "Missing check-out or too few hours. Not payable until regularized."],
    ["Absent", figures.absentDays, "No attendance on a scheduled working day."],
  ];
  const visible = notCounted.filter(([, count]) => count > 0);

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-accent/60 p-4">
        <p className="text-xs font-medium text-accent-foreground">Monthly basic × payable units ÷ divisor</p>
        <p className="mt-1 text-base font-semibold text-foreground tabular-nums sm:text-lg">
          {formatCurrency(figures.monthlyBasicSalary)} × {formatUnits(figures.payableUnits)} ÷ {figures.divisor} ={" "}
          <span className="text-primary">{formatCurrency(figures.estimatedSalary)}</span>
        </p>
        {figures.cappedAtBasic && (
          <p className="mt-1 text-xs text-muted-foreground">The result was capped at the monthly basic salary.</p>
        )}
      </div>

      <div className="space-y-2.5">
        <LedgerRow label="Monthly basic salary" value={formatCurrency(figures.monthlyBasicSalary)} />
        <LedgerRow label="Scheduled working days" value={figures.scheduledWorkingDays} />
        <LedgerRow
          label="Salary divisor"
          value={figures.divisor}
          note={DIVISOR_POLICY_LABELS[figures.divisorPolicy]}
        />
        <LedgerRow label="Rate per day" value={formatCurrency(figures.perDayRate, { digits: 2 })} />
      </div>

      <div className="space-y-2.5 border-t pt-4">
        <LedgerRow label="Approved full days" value={figures.approvedFullDays} />
        <LedgerRow
          label={`Approved half days × ${formatUnits(figures.halfDayUnits)}`}
          value={`${figures.approvedHalfDays} → ${formatUnits(figures.approvedHalfDays * figures.halfDayUnits)}`}
        />
        <LedgerRow label="Payable attendance units" value={formatUnits(figures.payableUnits)} />
      </div>

      <div className="border-t pt-4">
        <LedgerRow label="Estimated salary" value={formatCurrency(figures.estimatedSalary)} strong />
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-semibold text-foreground">Days not counted</h4>
        {visible.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">Every scheduled day so far is counted.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {visible.map(([label, count, note]) => (
              <li key={label}>
                <LedgerRow label={label} value={count} note={note} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface SalaryBreakdownProps {
  row: PayrollRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Show whose salary this is. Used by the admin view. */
  showEmployee?: boolean;
}

export function SalaryBreakdown({ row, open, onOpenChange, showEmployee = false }: SalaryBreakdownProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto sm:max-w-lg">
        {row && (
          <>
            <DialogHeader className="gap-3">
              {showEmployee && (
                <div className="flex items-center gap-3">
                  <UserAvatar name={row.employee.fullName} photo={row.employee.photoUrl} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.employee.id}, {row.employee.designation}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <DialogTitle className="text-xl font-semibold">
                  {formatMonthYear(row.year, row.month)} salary
                </DialogTitle>
                <PayrollStatusBadge status={row.status} />
              </div>
              <DialogDescription>
                {row.isLive
                  ? "A live estimate from the attendance approved so far. It changes as days are approved."
                  : `Frozen when payroll was finalized on ${row.record?.finalizedAt ? formatDateTime(row.record.finalizedAt) : "an earlier date"}.`}
              </DialogDescription>
            </DialogHeader>

            <SalaryBreakdownBody figures={row.figures} />

            {row.record?.status === "paid" && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium text-foreground">Payment recorded</p>
                <p className="mt-1 text-muted-foreground">
                  {row.record.paidAt ? formatDateTime(row.record.paidAt) : "Date unavailable"}
                  {row.record.paymentReference ? `, reference ${row.record.paymentReference}` : ""}
                </p>
              </div>
            )}

            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Calculated from approved attendance. It is not an official payslip, and no money is moved through this
              app.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
