"use client";

import { PayrollRowActions } from "@/components/payroll/PayrollRowActions";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatCurrency, formatUnits } from "@/lib/format";
import type { PayrollRow } from "@/types/payroll";

interface PayrollCardListProps {
  rows: PayrollRow[];
  onView: (row: PayrollRow) => void;
  onFinalize: (row: PayrollRow) => void;
  onMarkPaid: (row: PayrollRow) => void;
}

/** The payroll table reshaped for phones: the salary and status first, the working underneath. */
export function PayrollCardList({ rows, onView, onFinalize, onMarkPaid }: PayrollCardListProps) {
  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const { employee, figures } = row;
        const stats: Array<[string, string | number]> = [
          ["Scheduled days", figures.scheduledWorkingDays],
          ["Full days", figures.approvedFullDays],
          ["Half days", figures.approvedHalfDays],
          ["Absent days", figures.unpaidDays],
          ["Payable units", formatUnits(figures.payableUnits)],
          ["Basic salary", formatCurrency(figures.monthlyBasicSalary)],
        ];
        return (
          <li key={`${employee.id}-${row.year}-${row.month}`} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {employee.id}
                    {employee.status === "inactive" ? ", deactivated" : ""}
                  </p>
                </div>
              </div>
              <PayrollStatusBadge status={row.status} className="shrink-0" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Estimated salary</p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatCurrency(figures.estimatedSalary)}
                {figures.pendingDays > 0 && (
                  <span className="ml-2 text-xs font-medium text-orange-700">+{figures.pendingDays} pending</span>
                )}
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 rounded-lg bg-muted/40 p-3 text-xs">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-medium text-foreground tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <PayrollRowActions row={row} onView={onView} onFinalize={onFinalize} onMarkPaid={onMarkPaid} fill />
          </li>
        );
      })}
    </ul>
  );
}
