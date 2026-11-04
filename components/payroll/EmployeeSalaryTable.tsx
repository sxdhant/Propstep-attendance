"use client";

import { Eye } from "lucide-react";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PayrollRow } from "@/types/payroll";

const HEAD = "h-11 px-4 text-xs font-medium text-muted-foreground";
const CELL = "px-4 py-3";

export function EmployeeSalaryTable({ rows, onView }: { rows: PayrollRow[]; onView: (row: PayrollRow) => void }) {
  return (
    <Table className="min-w-[860px]">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Payroll Month</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Basic Salary</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Approved Full Days</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Approved Half Days</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Absences</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Salary</TableHead>
          <TableHead className={HEAD}>Payment Status</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.year}-${row.month}`}>
            <TableCell className={cn(CELL, "font-medium")}>{formatMonthYear(row.year, row.month)}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{formatCurrency(row.figures.monthlyBasicSalary)}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.figures.approvedFullDays}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.figures.approvedHalfDays}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.figures.unpaidDays}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>
              <span className="font-semibold">{formatCurrency(row.figures.estimatedSalary)}</span>
              <span className="block text-[11px] text-muted-foreground">{row.isLive ? "Estimate" : "Finalized"}</span>
            </TableCell>
            <TableCell className={CELL}>
              <PayrollStatusBadge status={row.status} label={row.status === "not_generated" ? "In Progress" : undefined} />
            </TableCell>
            <TableCell className={cn(CELL, "text-right")}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onView(row)}
                aria-label={`View details for ${formatMonthYear(row.year, row.month)}`}
              >
                <Eye className="size-3.5" aria-hidden />
                View Details
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
