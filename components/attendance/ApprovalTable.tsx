"use client";

import { Lock } from "lucide-react";
import { ApprovalStatusBadge, AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { getReviewBlocks, ReviewActions } from "@/components/attendance/ReviewActions";
import { StickyCell, StickyHead } from "@/components/shared/StickyCells";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import type { ApprovalRow } from "@/lib/selectors/admin";
import { cn } from "@/lib/utils";

interface ApprovalTableProps {
  rows: ApprovalRow[];
  onView: (row: ApprovalRow) => void;
  onApprove: (row: ApprovalRow) => void;
  onReject: (row: ApprovalRow) => void;
}

const HEAD = "h-10 px-3 text-xs leading-tight font-medium whitespace-normal text-muted-foreground";
const CELL = "px-3 py-2.5";

/** Secondary status chip shown beside the approval state when the day needs attention or is partial. */
export function needsAttendanceChip(row: ApprovalRow): boolean {
  const status = row.record.effectiveStatus;
  return status === "incomplete" || status === "half_day" || status === "in_progress";
}

export function LateChip({ minutes }: { minutes: number }) {
  return (
    <span
      className="rounded bg-yellow-50 px-1.5 py-0.5 text-[11px] font-medium text-yellow-800 ring-1 ring-yellow-600/25 ring-inset"
      title={`${minutes} minutes after the office start time`}
    >
      Late
    </span>
  );
}

export function ApprovalTable({ rows, onView, onApprove, onReject }: ApprovalTableProps) {
  return (
    <Table className="min-w-[1020px] text-[0.8125rem]">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Employee</TableHead>
          <TableHead className={HEAD}>Employee ID</TableHead>
          <TableHead className={HEAD}>Date</TableHead>
          <TableHead className={HEAD}>Check-In Time</TableHead>
          <TableHead className={HEAD}>Check-Out Time</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Working Duration</TableHead>
          <TableHead className={HEAD}>Status</TableHead>
          <StickyHead className={cn(HEAD, "text-right")}>Actions</StickyHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { employee, record, locked } = row;
          const { awaitingCheckout } = getReviewBlocks(row);

          return (
            <TableRow key={record.id} className="group/row">
              <TableCell className={CELL}>
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={employee.fullName} size="sm" />
                  <span className="font-medium">{employee.fullName}</span>
                </div>
              </TableCell>
              <TableCell className={cn(CELL, "text-muted-foreground")}>{employee.id}</TableCell>
              <TableCell className={CELL}>{formatDate(record.date)}</TableCell>
              <TableCell className={CELL}>
                <span className="inline-flex items-center gap-1.5">
                  {formatTime(record.checkIn)}
                  {record.isLate && <LateChip minutes={record.lateMinutes} />}
                </span>
              </TableCell>
              <TableCell className={CELL}>{formatTime(record.checkOut)}</TableCell>
              <TableCell className={cn(CELL, "text-right")}>
                {awaitingCheckout ? <span className="text-muted-foreground">Working</span> : formatDuration(record.workedMinutes)}
              </TableCell>
              <TableCell className={CELL}>
                <div className="flex items-center gap-1.5">
                  <ApprovalStatusBadge status={record.approval} />
                  {needsAttendanceChip(row) && <AttendanceStatusBadge status={record.effectiveStatus} />}
                  {locked && (
                    <span title="Payroll for this month is finalized" className="text-muted-foreground">
                      <Lock className="size-3.5" aria-label="Locked by payroll" />
                    </span>
                  )}
                </div>
              </TableCell>
              <StickyCell className={CELL}>
                <ReviewActions row={row} onView={onView} onApprove={onApprove} onReject={onReject} />
              </StickyCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
