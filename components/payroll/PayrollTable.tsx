"use client";

import { Info } from "lucide-react";
import { PayrollRowActions } from "@/components/payroll/PayrollRowActions";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { StickyCell, StickyHead } from "@/components/shared/StickyCells";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatUnits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PayrollRow } from "@/types/payroll";

interface PayrollTableProps {
  rows: PayrollRow[];
  onView: (row: PayrollRow) => void;
  /** Generating is required before a line can be finalized. */
  onFinalize: (row: PayrollRow) => void;
  onMarkPaid: (row: PayrollRow) => void;
}

const HEAD = "h-10 px-3 text-xs leading-tight font-medium whitespace-normal text-muted-foreground";
const NUM_HEAD = `${HEAD} text-right`;
const CELL = "px-3 py-2.5";

function HeadWithHint({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={`About ${label}`} className="rounded text-muted-foreground/70 hover:text-foreground">
            <Info className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-56">{hint}</TooltipContent>
      </Tooltip>
    </span>
  );
}

export function PayrollTable({ rows, onView, onFinalize, onMarkPaid }: PayrollTableProps) {
  return (
    <Table className="min-w-[1100px] text-[0.8125rem]">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Employee ID</TableHead>
          <TableHead className={HEAD}>Employee Name</TableHead>
          <TableHead className={NUM_HEAD}>Monthly Basic Salary</TableHead>
          <TableHead className={NUM_HEAD}>Scheduled Working Days</TableHead>
          <TableHead className={NUM_HEAD}>Approved Full Days</TableHead>
          <TableHead className={NUM_HEAD}>Approved Half Days</TableHead>
          <TableHead className={NUM_HEAD}>
            <HeadWithHint label="Absent Days" hint="Absent, rejected and incomplete days: scheduled days that earn nothing." />
          </TableHead>
          <TableHead className={NUM_HEAD}>Payable Attendance Units</TableHead>
          <TableHead className={NUM_HEAD}>Estimated Salary</TableHead>
          <TableHead className={HEAD}>Payroll Status</TableHead>
          <StickyHead className={cn(HEAD, "text-right")}>Actions</StickyHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { employee, figures } = row;
          return (
            <TableRow key={`${employee.id}-${row.year}-${row.month}`} className="group/row">
              <TableCell className={cn(CELL, "text-muted-foreground")}>{employee.id}</TableCell>
              <TableCell className={CELL}>
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="font-medium">{employee.fullName}</p>
                    {employee.status === "inactive" && <p className="text-xs text-muted-foreground">Deactivated</p>}
                  </div>
                </div>
              </TableCell>
              <TableCell className={cn(CELL, "text-right")}>{formatCurrency(figures.monthlyBasicSalary)}</TableCell>
              <TableCell className={cn(CELL, "text-right")}>{figures.scheduledWorkingDays}</TableCell>
              <TableCell className={cn(CELL, "text-right")}>{figures.approvedFullDays}</TableCell>
              <TableCell className={cn(CELL, "text-right")}>{figures.approvedHalfDays}</TableCell>
              <TableCell className={cn(CELL, "text-right")}>{figures.unpaidDays}</TableCell>
              <TableCell className={cn(CELL, "text-right")}>
                <span className="font-medium">{formatUnits(figures.payableUnits)}</span>
                {figures.pendingDays > 0 && (
                  <span className="block text-[11px] text-orange-700">+{figures.pendingDays} pending</span>
                )}
              </TableCell>
              <TableCell className={cn(CELL, "text-right font-semibold")}>{formatCurrency(figures.estimatedSalary)}</TableCell>
              <TableCell className={CELL}>
                <PayrollStatusBadge status={row.status} />
              </TableCell>
              <StickyCell className={CELL}>
                <PayrollRowActions row={row} onView={onView} onFinalize={onFinalize} onMarkPaid={onMarkPaid} />
              </StickyCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
