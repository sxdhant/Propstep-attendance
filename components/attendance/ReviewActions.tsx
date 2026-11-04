"use client";

import { Check, Eye, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import type { ApprovalRow } from "@/lib/selectors/admin";
import { cn } from "@/lib/utils";

/** Why an approve or reject action is unavailable for a record, if it is. */
export interface ReviewBlocks {
  approve?: string;
  reject?: string;
  /** Checked in today and not yet checked out, so the day can't be judged yet. */
  awaitingCheckout: boolean;
}

export function getReviewBlocks({ record, locked }: ApprovalRow): ReviewBlocks {
  const awaitingCheckout = record.isOpen && record.isToday;
  const lockedReason = "Payroll for this month is finalized.";
  return {
    awaitingCheckout,
    approve: locked
      ? lockedReason
      : record.approval === "approved"
        ? "Already approved."
        : undefined,
    reject: locked ? lockedReason : record.approval === "rejected" ? "Already rejected." : undefined,
  };
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabledReason,
  tone,
  className,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** When set, the action is disabled and the tooltip explains why. */
  disabledReason?: string;
  tone: "approve" | "reject";
  className?: string;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={Boolean(disabledReason)}
      onClick={onClick}
      className={cn(
        tone === "approve"
          ? "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
          : "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Button>
  );

  if (!disabledReason) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            className,
          )}
        >
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

interface ReviewActionsProps {
  row: ApprovalRow;
  onView: (row: ApprovalRow) => void;
  onApprove: (row: ApprovalRow) => void;
  onReject: (row: ApprovalRow) => void;
  /** Stretch the buttons across the available width (used on phones). */
  fill?: boolean;
  className?: string;
}

/** View, approve and reject for one attendance record, shared by the table and the phone card list. */
export function ReviewActions({ row, onView, onApprove, onReject, fill = false, className }: ReviewActionsProps) {
  const blocks = getReviewBlocks(row);
  const { employee, record } = row;
  return (
    <div className={cn("flex items-center gap-1.5", fill ? "w-full" : "justify-end", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={fill ? "outline" : "ghost"}
            size={fill ? "sm" : "icon-sm"}
            aria-label={`View details for ${employee.fullName} on ${formatDate(record.date)}`}
            onClick={() => onView(row)}
          >
            <Eye className="size-4" aria-hidden />
            {fill && "Details"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      <ActionButton
        label="Approve"
        icon={Check}
        tone="approve"
        disabledReason={blocks.approve}
        onClick={() => onApprove(row)}
        className={fill ? "flex-1 [&>button]:w-full" : undefined}
      />
      <ActionButton
        label="Reject"
        icon={X}
        tone="reject"
        disabledReason={blocks.reject}
        onClick={() => onReject(row)}
        className={fill ? "flex-1 [&>button]:w-full" : undefined}
      />
    </div>
  );
}
