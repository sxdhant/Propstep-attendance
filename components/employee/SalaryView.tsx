"use client";

import { CalendarClock, History, Info, Landmark, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmployeeSalaryTable } from "@/components/payroll/EmployeeSalaryTable";
import { SalaryBreakdown } from "@/components/payroll/SalaryBreakdown";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAppData } from "@/hooks/use-app-data";
import { compareMonths, monthOf, shiftMonth } from "@/lib/date-utils";
import { formatCurrency, formatDate, formatMonthYear, formatUnits } from "@/lib/format";
import { isEmployeeInPayrollMonth, payDateFor } from "@/lib/payroll-utils";
import { calculateSalary, DIVISOR_POLICY_LABELS, SALARY_EXAMPLE } from "@/lib/salary-calculator";
import { getDataWindowStart } from "@/lib/selectors/context";
import { selectLastPaid, selectPayrollHistory } from "@/lib/selectors/employee";
import type { PayrollRow } from "@/types/payroll";

const HISTORY_MONTHS = 4;

export function EmployeeSalaryView() {
  const { db, ctx, employee, today } = useAppData();
  const current = monthOf(today);
  // The month stays selected after the dialog closes so its content doesn't vanish mid-animation.
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = useMemo(() => {
    const windowStart = getDataWindowStart(db);
    const months = Array.from({ length: HISTORY_MONTHS }, (_, i) => shiftMonth(current, -i)).filter(
      (m) => compareMonths(m, windowStart) >= 0 && isEmployeeInPayrollMonth(employee, m.year, m.month),
    );
    return selectPayrollHistory(db, ctx, employee.id, months);
  }, [db, ctx, employee, current]);

  const lastPaid = useMemo(() => selectLastPaid(db, employee.id), [db, employee.id]);

  const currentRow = rows.find((row) => row.year === current.year && row.month === current.month);
  const policy = db.settings.salary;
  const payDate = payDateFor(current.year, current.month, policy.payDay);
  const selected: PayrollRow | null = rows.find((row) => `${row.year}-${row.month}` === openMonth) ?? null;

  const example = calculateSalary(SALARY_EXAMPLE, {
    ...policy,
    divisorPolicy: "scheduled_working_days",
    halfDayUnits: 0.5,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary"
        description="What you have earned so far this month and your payroll history, with the working shown."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Monthly Basic Salary"
          value={formatCurrency(employee.monthlyBasicSalary)}
          hint={employee.designation}
          icon={Landmark}
          tone="blue"
        />
        <StatCard
          label="Estimated Current Salary"
          value={formatCurrency(currentRow?.figures.estimatedSalary ?? 0)}
          hint={
            currentRow
              ? `${formatMonthYear(current.year, current.month)}: ${formatUnits(currentRow.figures.payableUnits)} payable units so far`
              : "No attendance yet"
          }
          icon={Wallet}
          tone="blue"
        />
        <StatCard
          label="Last Paid Salary"
          value={lastPaid ? formatCurrency(lastPaid.snapshot?.estimatedSalary ?? 0) : "—"}
          hint={
            lastPaid
              ? `${formatMonthYear(lastPaid.year, lastPaid.month)}, paid ${lastPaid.paidAt ? formatDate(lastPaid.paidAt.slice(0, 10)) : ""}`
              : "No salary has been paid yet"
          }
          icon={History}
          tone="green"
        />
        <StatCard
          label="Next Expected Payroll"
          value={formatDate(payDate)}
          hint={`For ${formatMonthYear(current.year, current.month)}, paid on day ${policy.payDay} of the next month`}
          icon={CalendarClock}
          tone="violet"
        />
      </div>

      <Alert>
        <Info aria-hidden />
        <AlertTitle>Estimated figures</AlertTitle>
        <AlertDescription>
          These amounts are calculated from the attendance approved so far and can change until your administrator
          finalizes the month. They are not a payslip.
        </AlertDescription>
      </Alert>

      <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <header className="px-5 pt-5 pb-4">
          <h2 className="text-base font-semibold text-foreground">Salary history</h2>
          <p className="text-sm text-muted-foreground">
            Finalized months are frozen. The current month updates as your days are approved.
          </p>
        </header>
        {rows.length === 0 ? (
          <EmptyState title="No payroll yet" description="Your first payroll appears once you have attendance on record." />
        ) : (
          <div className="border-t">
            <EmployeeSalaryTable
              rows={rows}
              onView={(row) => {
                setOpenMonth(`${row.year}-${row.month}`);
                setDialogOpen(true);
              }}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">How your salary is estimated</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <div className="rounded-lg bg-muted/50 p-4 text-foreground">
              <p>
                <span className="font-medium">Payable units</span> = approved full days + (approved half days ×{" "}
                {formatUnits(policy.halfDayUnits)})
              </p>
              <p className="mt-2">
                <span className="font-medium">Estimated salary</span> = monthly basic × payable units ÷ salary divisor
              </p>
            </div>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Only days an administrator has approved are counted. Pending days are added once approved.</li>
              <li>
                Your company divides by <span className="font-medium text-foreground">{DIVISOR_POLICY_LABELS[policy.divisorPolicy].toLowerCase()}</span>
                {policy.divisorPolicy === "fixed" ? ` (${policy.fixedDivisor})` : ""}.
              </li>
              <li>Weekly offs and holidays are paid, because they are part of the monthly basic.</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium text-muted-foreground">Worked example</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Basic {formatCurrency(SALARY_EXAMPLE.monthlyBasicSalary)}, {SALARY_EXAMPLE.scheduledWorkingDays} scheduled
              days, {SALARY_EXAMPLE.approvedFullDays} approved full days and {SALARY_EXAMPLE.approvedHalfDays} approved
              half day.
            </p>
            <p className="mt-3 text-sm text-foreground tabular-nums">
              {SALARY_EXAMPLE.approvedFullDays} + ({SALARY_EXAMPLE.approvedHalfDays} × 0.5) ={" "}
              <span className="font-semibold">{formatUnits(example.payableUnits)} units</span>
            </p>
            <p className="mt-1 text-base font-semibold text-foreground tabular-nums">
              {formatCurrency(SALARY_EXAMPLE.monthlyBasicSalary)} × {formatUnits(example.payableUnits)} ÷ {example.divisor} ={" "}
              <span className="text-primary">{formatCurrency(example.estimatedSalary)}</span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">An estimate, not a payslip.</p>
          </div>
        </div>
      </section>

      <SalaryBreakdown row={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
