"use client";

import { ApprovalStatusBadge, AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatMonthYear,
  formatPercent,
  formatTime,
  formatUnits,
  formatWeekday,
} from "@/lib/format";
import type { EmployeeBreakdown, ReportRow } from "@/lib/selectors/reports";
import { cn } from "@/lib/utils";
import type { PayrollRow } from "@/types/payroll";

const HEAD = "h-11 px-4 text-xs font-medium text-muted-foreground";
const NUM_HEAD = `${HEAD} text-right`;
const CELL = "px-4 py-3";

function Person({ name, id }: { name: string; id: string }) {
  return (
    <div className="flex items-center gap-3">
      <UserAvatar name={name} size="sm" />
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{id}</p>
      </div>
    </div>
  );
}

export function EmployeeSummaryTable({ rows }: { rows: EmployeeBreakdown[] }) {
  return (
    <Table className="min-w-[980px]">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Employee</TableHead>
          <TableHead className={HEAD}>Department</TableHead>
          <TableHead className={NUM_HEAD}>Approved</TableHead>
          <TableHead className={NUM_HEAD}>Pending</TableHead>
          <TableHead className={NUM_HEAD}>Rejected</TableHead>
          <TableHead className={NUM_HEAD}>Absent</TableHead>
          <TableHead className={NUM_HEAD}>Incomplete</TableHead>
          <TableHead className={NUM_HEAD}>Late</TableHead>
          <TableHead className={NUM_HEAD}>Hours</TableHead>
          <TableHead className={NUM_HEAD}>Attendance rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.employee.id}>
            <TableCell className={CELL}>
              <Person name={row.employee.fullName} id={row.employee.id} />
            </TableCell>
            <TableCell className={CELL}>{row.employee.department}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.approved}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.pending}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.rejected}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.absent}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.incomplete}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{row.lateArrivals}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{formatDuration(row.minutes)}</TableCell>
            <TableCell className={cn(CELL, "text-right font-medium")}>{formatPercent(row.attendanceRate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RegisterTable({ rows }: { rows: ReportRow[] }) {
  return (
    <Table className="min-w-[900px]">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Employee</TableHead>
          <TableHead className={HEAD}>Date</TableHead>
          <TableHead className={HEAD}>Day</TableHead>
          <TableHead className={HEAD}>Check-in</TableHead>
          <TableHead className={HEAD}>Check-out</TableHead>
          <TableHead className={NUM_HEAD}>Hours</TableHead>
          <TableHead className={HEAD}>Attendance</TableHead>
          <TableHead className={HEAD}>Approval</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ employee, entry }) => (
          <TableRow key={`${employee.id}-${entry.date}`}>
            <TableCell className={CELL}>
              <Person name={employee.fullName} id={employee.id} />
            </TableCell>
            <TableCell className={CELL}>{formatDate(entry.date)}</TableCell>
            <TableCell className={cn(CELL, "text-muted-foreground")}>{formatWeekday(entry.date)}</TableCell>
            <TableCell className={CELL}>{formatTime(entry.record?.checkIn)}</TableCell>
            <TableCell className={CELL}>{formatTime(entry.record?.checkOut)}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>{formatDuration(entry.record?.workedMinutes)}</TableCell>
            <TableCell className={CELL}>
              <AttendanceStatusBadge status={entry.attendanceStatus} />
            </TableCell>
            <TableCell className={CELL}>
              <ApprovalStatusBadge status={entry.approvalStatus} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PayrollReportTable({ rows }: { rows: PayrollRow[] }) {
  return (
    <Table className="min-w-[900px]">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Month</TableHead>
          <TableHead className={HEAD}>Employee</TableHead>
          <TableHead className={NUM_HEAD}>Basic salary</TableHead>
          <TableHead className={NUM_HEAD}>Approved days</TableHead>
          <TableHead className={NUM_HEAD}>Payable units</TableHead>
          <TableHead className={NUM_HEAD}>Salary</TableHead>
          <TableHead className={HEAD}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.employee.id}-${row.year}-${row.month}`}>
            <TableCell className={cn(CELL, "font-medium")}>{formatMonthYear(row.year, row.month)}</TableCell>
            <TableCell className={CELL}>
              <Person name={row.employee.fullName} id={row.employee.id} />
            </TableCell>
            <TableCell className={cn(CELL, "text-right")}>{formatCurrency(row.figures.monthlyBasicSalary)}</TableCell>
            <TableCell className={cn(CELL, "text-right")}>
              {row.figures.approvedFullDays + row.figures.approvedHalfDays}
            </TableCell>
            <TableCell className={cn(CELL, "text-right")}>{formatUnits(row.figures.payableUnits)}</TableCell>
            <TableCell className={cn(CELL, "text-right font-semibold")}>
              {formatCurrency(row.figures.estimatedSalary)}
            </TableCell>
            <TableCell className={CELL}>
              <PayrollStatusBadge status={row.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
