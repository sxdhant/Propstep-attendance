"use client";

import { BadgeCheck, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PayrollRow } from "@/types/payroll";

interface PayrollRowActionsProps {
  row: PayrollRow;
  onView: (row: PayrollRow) => void;
  onFinalize: (row: PayrollRow) => void;
  onMarkPaid: (row: PayrollRow) => void;
  /** Stretch the primary button across the available width (used on phones). */
  fill?: boolean;
}

/** Breakdown plus the one next step for a payroll line: finalize it, pay it, or see that it is paid. */
export function PayrollRowActions({ row, onView, onFinalize, onMarkPaid, fill = false }: PayrollRowActionsProps) {
  const { employee } = row;
  const primary = cn(fill ? "flex-1" : "min-w-[6.5rem]");

  return (
    <div className={cn("flex items-center gap-1.5", fill ? "w-full" : "justify-end")}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={fill ? "outline" : "ghost"}
            size={fill ? "sm" : "icon-sm"}
            aria-label={`View salary breakdown for ${employee.fullName}`}
            onClick={() => onView(row)}
          >
            <Eye className="size-4" aria-hidden />
            {fill && "Breakdown"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>View breakdown</TooltipContent>
      </Tooltip>

      {row.status === "paid" && (
        <span className={cn("inline-flex items-center justify-end gap-1 px-1 text-xs text-muted-foreground", primary)}>
          <BadgeCheck className="size-3.5 text-green-600" aria-hidden />
          {row.record?.paidAt ? `Paid ${formatDate(row.record.paidAt.slice(0, 10), "short")}` : "Paid"}
        </span>
      )}
      {row.status === "finalized" && (
        <Button type="button" size="sm" className={primary} onClick={() => onMarkPaid(row)}>
          Mark as Paid
        </Button>
      )}
      {row.status === "draft" && (
        <Button type="button" size="sm" variant="outline" className={primary} onClick={() => onFinalize(row)}>
          <Lock className="size-3.5" aria-hidden />
          Finalize
        </Button>
      )}
      {row.status === "not_generated" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className={cn(
                "inline-flex rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                fill && "flex-1",
              )}
            >
              <Button type="button" size="sm" variant="outline" className={cn(primary, "w-full")} disabled>
                <Lock className="size-3.5" aria-hidden />
                Finalize
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Generate payroll for this month first.</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
