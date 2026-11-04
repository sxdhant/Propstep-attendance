"use client";

import { ApprovalStatusBadge, AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { RowButton } from "@/components/shared/RowButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DayEntry } from "@/lib/attendance-utils";
import { formatDate, formatDuration, formatTime, formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AttendanceTableProps {
  entries: DayEntry[];
  onSelect: (entry: DayEntry) => void;
}

export function RemarksCell({ entry }: { entry: DayEntry }) {
  const record = entry.record;
  if (!record) {
    const text = entry.holidayName ?? (entry.kind === "weekly_off" ? "Weekly off" : "");
    return <span className="text-muted-foreground">{text || "—"}</span>;
  }
  return (
    <div className="max-w-64 min-w-0">
      <p className="truncate" title={record.remarks}>
        {record.remarks ?? <span className="text-muted-foreground">—</span>}
      </p>
      {record.approval === "rejected" && record.rejectionReason && (
        <p className="truncate text-xs text-red-700" title={record.rejectionReason}>
          Rejected: {record.rejectionReason}
        </p>
      )}
    </div>
  );
}

export function TimeCell({ entry }: { entry: DayEntry }) {
  const record = entry.record;
  return (
    <span className="inline-flex items-center gap-1.5">
      {formatTime(record?.checkIn)}
      {record?.isLate && (
        <span
          className="rounded bg-yellow-50 px-1.5 py-0.5 text-[11px] font-medium text-yellow-800 ring-1 ring-yellow-600/25 ring-inset"
          title={`Checked in ${record.lateMinutes} minutes after the office start time`}
        >
          Late
        </span>
      )}
    </span>
  );
}

const HEAD = "h-11 px-4 text-xs font-medium text-muted-foreground";
const CELL = "px-4 py-3";

/** One row per calendar day. Rows open the record-details drawer. */
export function AttendanceTable({ entries, onSelect }: AttendanceTableProps) {
  return (
    <Table>
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Date</TableHead>
          <TableHead className={HEAD}>Day</TableHead>
          <TableHead className={HEAD}>Check-in</TableHead>
          <TableHead className={HEAD}>Check-out</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Duration</TableHead>
          <TableHead className={HEAD}>Attendance</TableHead>
          <TableHead className={HEAD}>Approval</TableHead>
          <TableHead className={HEAD}>Remarks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.date} onClick={() => onSelect(entry)} className="cursor-pointer">
            <TableCell className={cn(CELL, "font-medium")}>
              <RowButton hint="view details" onClick={() => onSelect(entry)}>
                {formatDate(entry.date)}
              </RowButton>
            </TableCell>
            <TableCell className={cn(CELL, "text-muted-foreground")}>{formatWeekday(entry.date)}</TableCell>
            <TableCell className={CELL}>
              <TimeCell entry={entry} />
            </TableCell>
            <TableCell className={CELL}>{formatTime(entry.record?.checkOut)}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{formatDuration(entry.record?.workedMinutes)}</TableCell>
            <TableCell className={CELL}>
              <AttendanceStatusBadge status={entry.attendanceStatus} />
            </TableCell>
            <TableCell className={CELL}>
              <ApprovalStatusBadge status={entry.approvalStatus} />
            </TableCell>
            <TableCell className={CELL}>
              <RemarksCell entry={entry} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
