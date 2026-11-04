"use client";

import Link from "next/link";
import { ApprovalStatusBadge, AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { TimeCell } from "@/components/attendance/AttendanceTable";
import { RowButton } from "@/components/shared/RowButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DayEntry } from "@/lib/attendance-utils";
import { formatDate, formatDuration, formatTime, formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";

const HEAD = "h-10 px-4 text-xs font-medium text-muted-foreground";
const CELL = "px-4 py-2.5";

/** The last few days at a glance, for the employee dashboard. */
export function RecentAttendance({
  entries,
  onSelect,
  className,
}: {
  entries: DayEntry[];
  onSelect: (entry: DayEntry) => void;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10", className)}>
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recent attendance</h2>
          <p className="text-sm text-muted-foreground">Your last {entries.length} recorded days</p>
        </div>
        <Link
          href="/employee/attendance"
          className="rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          View all
        </Link>
      </header>

      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className={HEAD}>Date</TableHead>
            <TableHead className={HEAD}>Check-in</TableHead>
            <TableHead className={HEAD}>Check-out</TableHead>
            <TableHead className={cn(HEAD, "text-right")}>Hours</TableHead>
            <TableHead className={HEAD}>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.date} onClick={() => onSelect(entry)} className="cursor-pointer">
              <TableCell className={CELL}>
                <RowButton hint={`view details for ${formatDate(entry.date, "long")}`} onClick={() => onSelect(entry)} className="font-medium">
                  {formatDate(entry.date, "short")}
                </RowButton>
                <span className="ml-2 text-muted-foreground">{formatWeekday(entry.date)}</span>
              </TableCell>
              <TableCell className={CELL}>
                <TimeCell entry={entry} />
              </TableCell>
              <TableCell className={CELL}>{formatTime(entry.record?.checkOut)}</TableCell>
              <TableCell className={cn(CELL, "text-right")}>{formatDuration(entry.record?.workedMinutes)}</TableCell>
              <TableCell className={CELL}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.approvalStatus !== "not_required" ? (
                    <ApprovalStatusBadge status={entry.approvalStatus} />
                  ) : (
                    <AttendanceStatusBadge status={entry.attendanceStatus} />
                  )}
                  {entry.record && entry.approvalStatus !== "not_required" && entry.attendanceStatus !== "present" && (
                    <AttendanceStatusBadge status={entry.attendanceStatus} />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
