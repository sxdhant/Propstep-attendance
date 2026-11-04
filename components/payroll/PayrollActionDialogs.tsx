"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Lock, TriangleAlert } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DetailList } from "@/components/shared/DetailList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { monthEnd, monthOf } from "@/lib/date-utils";
import { formatCurrency, formatDateTime, formatMonthYear, formatUnits, pluralize } from "@/lib/format";
import { finalizeAllDrafts, finalizePayroll, markPayrollPaid } from "@/lib/services/payroll-service";
import { paymentSchema, type PaymentValues } from "@/lib/validation/schemas";
import { toIstTimestamp } from "@/lib/date-utils";
import type { PayrollRow } from "@/types/payroll";

interface RowDialogProps {
  row: PayrollRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MonthInProgressNote({ year, month }: { year: number; month: number }) {
  const { today } = useAppData();
  const inProgress = monthOf(today).year === year && monthOf(today).month === month && today < monthEnd(year, month);
  if (!inProgress) return null;
  return (
    <Alert className="border-orange-200 bg-orange-50 text-orange-900">
      <TriangleAlert aria-hidden />
      <AlertDescription className="text-orange-900/90">
        {formatMonthYear(year, month)} isn&apos;t over yet, so only attendance approved so far is included.
      </AlertDescription>
    </Alert>
  );
}

export function FinalizeDialog({ row, open, onOpenChange }: RowDialogProps) {
  const { admin } = useAppData();
  const [run, pending] = useAction(finalizePayroll);
  if (!row) return null;

  const { employee, figures, year, month } = row;
  const label = formatMonthYear(year, month);
  const uncounted = figures.pendingDays + figures.incompleteDays;

  const finalize = async () => {
    const result = await run({ employeeId: employee.id, year, month, adminId: admin.id });
    if (!result.ok) {
      toast.error("Couldn't finalize payroll", { description: result.error });
      return;
    }
    toast.success("Payroll finalized", {
      description: `${employee.fullName}, ${label}: ${formatCurrency(result.data.snapshot?.estimatedSalary ?? 0)}.`,
    });
    onOpenChange(false);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Finalize payroll"
      description={`This locks ${employee.fullName}'s ${label} salary. Its figures and that month's attendance can't be changed afterwards.`}
      icon={Lock}
      confirmLabel="Finalize Payroll"
      pending={pending}
      onConfirm={finalize}
    >
      <div className="rounded-lg border bg-muted/30 p-4">
        <DetailList
          items={[
            { label: "Employee", value: `${employee.fullName} (${employee.id})` },
            { label: "Payable attendance units", value: formatUnits(figures.payableUnits) },
            { label: "Estimated salary", value: formatCurrency(figures.estimatedSalary) },
          ]}
        />
      </div>
      {uncounted > 0 && (
        <Alert className="border-orange-200 bg-orange-50 text-orange-900">
          <TriangleAlert aria-hidden />
          <AlertDescription className="text-orange-900/90">
            {pluralize(uncounted, "day")} still pending or incomplete will not be counted. Review them on the
            attendance page first if they should be.
          </AlertDescription>
        </Alert>
      )}
      <MonthInProgressNote year={year} month={month} />
    </ConfirmDialog>
  );
}

interface FinalizeAllDialogProps {
  year: number;
  month: number;
  count: number;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FinalizeAllDialog({ year, month, count, total, open, onOpenChange }: FinalizeAllDialogProps) {
  const { admin } = useAppData();
  const [run, pending] = useAction(finalizeAllDrafts);
  const label = formatMonthYear(year, month);

  const finalize = async () => {
    const result = await run({ year, month, adminId: admin.id });
    if (!result.ok) {
      toast.error("Couldn't finalize payroll", { description: result.error });
      return;
    }
    toast.success(`Finalized ${pluralize(result.data.count, "payroll line")}`, {
      description: `${label} total ${formatCurrency(result.data.total)}.`,
    });
    onOpenChange(false);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Finalize all draft payroll"
      description={`Lock ${pluralize(count, "draft line")} for ${label}, totalling ${formatCurrency(total)}. Locked lines and their attendance can't be changed.`}
      icon={Lock}
      confirmLabel="Finalize All"
      pending={pending}
      onConfirm={finalize}
    >
      <MonthInProgressNote year={year} month={month} />
    </ConfirmDialog>
  );
}

export function MarkPaidDialog({ row, open, onOpenChange }: RowDialogProps) {
  const { admin, nowMs } = useAppData();
  const [run, pending] = useAction(markPayrollPaid);
  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { reference: "" },
  });

  if (!row) return null;
  const { employee, figures, year, month } = row;
  const label = formatMonthYear(year, month);
  const formId = `mark-paid-${employee.id}-${year}-${month}`;

  const submit = form.handleSubmit(async ({ reference }) => {
    const result = await run({ employeeId: employee.id, year, month, adminId: admin.id, reference });
    if (!result.ok) {
      toast.error("Couldn't mark as paid", { description: result.error });
      return;
    }
    toast.success("Marked as paid", {
      description: `${employee.fullName}, ${label}. Reference ${result.data.paymentReference}.`,
    });
    form.reset();
    onOpenChange(false);
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
      title="Mark salary as paid"
      description={`Record that ${employee.fullName}'s ${label} salary of ${formatCurrency(figures.estimatedSalary)} has been paid.`}
      icon={BadgeCheck}
      tone="success"
      confirmLabel="Mark as Paid"
      pending={pending}
      formId={formId}
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <Controller
          name="reference"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-reference`}>Payment reference</FieldLabel>
              <Input
                {...field}
                id={`${formId}-reference`}
                placeholder="For example, NEFT-2610-0042"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                autoFocus
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription>The transaction or UTR number from your bank.</FieldDescription>
              )}
            </Field>
          )}
        />
        <DetailList
          items={[{ label: "Payment date", value: formatDateTime(toIstTimestamp(new Date(nowMs))) }]}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          No money is moved. This only records a payment you made outside this app, and the date is set automatically.
        </p>
      </form>
    </ConfirmDialog>
  );
}
