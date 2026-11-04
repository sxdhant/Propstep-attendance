"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DetailList } from "@/components/shared/DetailList";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { formatDate, formatDuration, formatMonthYear, formatTime } from "@/lib/format";
import type { ApprovalRow } from "@/lib/selectors/admin";
import { reviewAttendance } from "@/lib/services/attendance-service";
import { rejectionSchema, type RejectionValues } from "@/lib/validation/schemas";
import { parseDateKey } from "@/lib/date-utils";

export type ApprovalMode = "approve" | "reject";

interface ApprovalDialogProps {
  /** Kept in place while the dialog animates closed, so its content never blanks out. */
  row: ApprovalRow | null;
  mode: ApprovalMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecordSummary({ row }: { row: ApprovalRow }) {
  const { employee, record } = row;
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-3 border-b pb-3">
        <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{employee.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {employee.id}, {employee.department}
          </p>
        </div>
      </div>
      <DetailList
        items={[
          { label: "Date", value: formatDate(record.date, "long") },
          { label: "Check-in", value: formatTime(record.checkIn) },
          { label: "Check-out", value: formatTime(record.checkOut) },
          { label: "Hours worked", value: formatDuration(record.workedMinutes) },
          { label: "Attendance", value: <AttendanceStatusBadge status={record.effectiveStatus} /> },
          { label: "Remarks", value: record.remarks ?? "—", hidden: !record.remarks },
        ]}
      />
    </div>
  );
}

function ApproveDialog({ row, open, onOpenChange }: Omit<ApprovalDialogProps, "mode"> & { row: ApprovalRow }) {
  const { admin } = useAppData();
  const [payableAs, setPayableAs] = useState<"full" | "half">("full");
  const [run, pending] = useAction(reviewAttendance);
  const { record, employee } = row;
  const isIncomplete = record.effectiveStatus === "incomplete";
  const { year, month } = parseDateKey(record.date);

  const approve = async () => {
    const result = await run({
      recordId: record.id,
      decision: "approve",
      adminId: admin.id,
      payableAs: isIncomplete ? payableAs : undefined,
    });
    if (!result.ok) {
      toast.error("Couldn't approve this day", { description: result.error });
      return;
    }
    toast.success("Attendance approved", {
      description: `${employee.fullName}, ${formatDate(record.date)}. Payroll estimates are updated.`,
    });
    onOpenChange(false);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Approve attendance"
      description={`This day will count towards ${employee.fullName}'s payroll for ${formatMonthYear(year, month)}.`}
      icon={CircleCheck}
      tone="success"
      confirmLabel="Approve"
      pending={pending}
      onConfirm={approve}
    >
      <RecordSummary row={row} />
      {isIncomplete && (
        <Field>
          <FieldLabel>This day has no valid check-out. Count it as</FieldLabel>
          <RadioGroup
            value={payableAs}
            onValueChange={(value) => setPayableAs(value as "full" | "half")}
            className="grid grid-cols-2 gap-2"
          >
            {(
              [
                ["full", "Full day", "1 payable day"],
                ["half", "Half day", "0.5 payable day"],
              ] as const
            ).map(([value, title, hint]) => (
              <label
                key={value}
                htmlFor={`payable-${value}`}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent/50"
              >
                <RadioGroupItem id={`payable-${value}`} value={value} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
          <FieldDescription>The record is marked as regularized by you.</FieldDescription>
        </Field>
      )}
    </ConfirmDialog>
  );
}

function RejectDialog({ row, open, onOpenChange }: Omit<ApprovalDialogProps, "mode"> & { row: ApprovalRow }) {
  const { admin } = useAppData();
  const [run, pending] = useAction(reviewAttendance);
  const { record, employee } = row;
  const formId = `reject-${record.id}`;

  const form = useForm<RejectionValues>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { reason: "" },
  });

  const reject = form.handleSubmit(async ({ reason }) => {
    const result = await run({ recordId: record.id, decision: "reject", adminId: admin.id, reason });
    if (!result.ok) {
      toast.error("Couldn't reject this day", { description: result.error });
      return;
    }
    toast.success("Attendance rejected", {
      description: `${employee.fullName}, ${formatDate(record.date)}. The reason was saved and the employee was notified.`,
    });
    onOpenChange(false);
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reject attendance"
      description={`${employee.fullName} will see your reason and this day will not count towards payroll.`}
      icon={CircleX}
      tone="destructive"
      confirmLabel="Reject"
      pending={pending}
      formId={formId}
    >
      <RecordSummary row={row} />
      <form id={formId} onSubmit={reject} noValidate>
        <Controller
          name="reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-reason`}>Reason for rejection</FieldLabel>
              <Textarea
                {...field}
                id={`${formId}-reason`}
                rows={3}
                placeholder="Explain what needs fixing, for example: check-in time does not match the roster."
                aria-invalid={fieldState.invalid}
                autoFocus
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription>Required. The employee sees this exactly as written.</FieldDescription>
              )}
            </Field>
          )}
        />
      </form>
    </ConfirmDialog>
  );
}

/** Approve or reject one attendance record, always behind an explicit confirmation. */
export function ApprovalDialog({ row, mode, open, onOpenChange }: ApprovalDialogProps) {
  if (!row) return null;
  // Remounting per record and mode resets the form and the "count as" choice.
  const key = `${row.record.id}-${mode}`;
  return mode === "approve" ? (
    <ApproveDialog key={key} row={row} open={open} onOpenChange={onOpenChange} />
  ) : (
    <RejectDialog key={key} row={row} open={open} onOpenChange={onOpenChange} />
  );
}
