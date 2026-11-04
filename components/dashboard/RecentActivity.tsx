"use client";

import Link from "next/link";
import {
  ActivityStateBadge,
  ApprovalStatusBadge,
} from "@/components/attendance/AttendanceStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { RowButton } from "@/components/shared/RowButton";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDuration, formatRelativeTime, formatTime } from "@/lib/format";
import type { ActivityRow } from "@/lib/selectors/admin";
import { cn } from "@/lib/utils";

const HEAD = "h-10 px-4 text-xs font-medium text-muted-foreground";
const CELL = "px-4 py-3";

/**
 * Latest attendance events across the company: who checked in, who checked
 * out, and what is still waiting for a decision.
 */
export function RecentActivity({
  rows,
  nowMs,
  onSelect,
  className,
}: {
  rows: ActivityRow[];
  nowMs: number;
  onSelect: (row: ActivityRow) => void;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10", className)}>
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recent attendance activity</h2>
          <p className="text-sm text-muted-foreground">Who has checked in, checked out or is waiting for approval</p>
        </div>
        <Link
          href="/admin/attendance"
          className="rounded-md text-sm font-medium whitespace-nowrap text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          Open approvals
        </Link>
      </header>

      {rows.length === 0 ? (
        <EmptyState title="No activity yet" description="Check-ins and approvals will appear here as they happen." />
      ) : (
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className={HEAD}>Employee</TableHead>
              <TableHead className={HEAD}>Date</TableHead>
              <TableHead className={HEAD}>Check-in</TableHead>
              <TableHead className={HEAD}>Check-out</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Duration</TableHead>
              <TableHead className={HEAD}>Activity</TableHead>
              <TableHead className={HEAD}>Approval</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.record.id} onClick={() => onSelect(row)} className="cursor-pointer">
                <TableCell className={CELL}>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={row.employee.fullName} size="sm" />
                    <div className="min-w-0">
                      <RowButton
                        hint={`view attendance on ${formatDate(row.record.date)}`}
                        onClick={() => onSelect(row)}
                        className="font-medium"
                      >
                        {row.employee.fullName}
                      </RowButton>
                      <p className="text-xs text-muted-foreground">{row.employee.id}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={CELL}>{formatDate(row.record.date, "short")}</TableCell>
                <TableCell className={CELL}>{formatTime(row.record.checkIn)}</TableCell>
                <TableCell className={CELL}>{formatTime(row.record.checkOut)}</TableCell>
                <TableCell className={cn(CELL, "text-right")}>{formatDuration(row.record.workedMinutes)}</TableCell>
                <TableCell className={CELL}>
                  <ActivityStateBadge record={row.record} />
                </TableCell>
                <TableCell className={CELL}>
                  <ApprovalStatusBadge status={row.record.approval} />
                </TableCell>
                <TableCell className={cn(CELL, "text-right text-muted-foreground")}>
                  {formatRelativeTime(row.at, nowMs)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
