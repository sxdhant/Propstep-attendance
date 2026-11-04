"use client";

import { EmployeeRowActions } from "@/components/employees/EmployeeRowActions";
import { ProfileStatusBadge } from "@/components/profile/ProfileStatusBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StickyCell, StickyHead } from "@/components/shared/StickyCells";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { getProfileStatus } from "@/lib/profile-utils";
import { ACCOUNT_STATUS_META } from "@/lib/status-config";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types/employee";

interface EmployeeTableProps {
  employees: Employee[];
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
}

const HEAD = "h-10 px-3 text-xs leading-tight font-medium whitespace-normal text-muted-foreground";
const CELL = "px-3 py-2.5";

export function EmployeeTable({ employees, onView, onEdit, onToggleStatus }: EmployeeTableProps) {
  return (
    <Table className="min-w-[1080px] text-[0.8125rem]">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Employee ID</TableHead>
          <TableHead className={HEAD}>Employee Name</TableHead>
          <TableHead className={HEAD}>Department</TableHead>
          <TableHead className={HEAD}>Designation</TableHead>
          <TableHead className={HEAD}>Email</TableHead>
          <TableHead className={HEAD}>Joining Date</TableHead>
          <TableHead className={cn(HEAD, "text-right")}>Monthly Basic Salary</TableHead>
          <TableHead className={HEAD}>Account Status</TableHead>
          <StickyHead className={cn(HEAD, "text-right")}>Actions</StickyHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id} className={cn("group/row", employee.status === "inactive" && "bg-muted/20")}>
            <TableCell className={cn(CELL, "text-muted-foreground")}>{employee.id}</TableCell>
            <TableCell className={CELL}>
              <button
                type="button"
                onClick={() => onView(employee)}
                className="group flex items-center gap-2.5 rounded-md text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="sm" />
                <span className="font-medium group-hover:text-primary group-hover:underline">{employee.fullName}</span>
              </button>
            </TableCell>
            <TableCell className={cn(CELL, "whitespace-normal")}>{employee.department}</TableCell>
            <TableCell className={cn(CELL, "max-w-[9.5rem] leading-snug whitespace-normal")}>{employee.designation}</TableCell>
            <TableCell className={cn(CELL, "text-muted-foreground")}>
              <span className="block max-w-[10.5rem] truncate" title={employee.email}>
                {employee.email}
              </span>
            </TableCell>
            <TableCell className={CELL}>{formatDate(employee.joiningDate)}</TableCell>
            <TableCell className={cn(CELL, "text-right font-medium")}>{formatCurrency(employee.monthlyBasicSalary)}</TableCell>
            <TableCell className={CELL}>
              <div className="flex flex-col items-start gap-1">
                <StatusBadge meta={ACCOUNT_STATUS_META[employee.status]} />
                {/* Only people who still owe a profile get a second badge, so the list stays quiet. */}
                {getProfileStatus(employee) !== "complete" && <ProfileStatusBadge employee={employee} />}
              </div>
            </TableCell>
            <StickyCell className={CELL}>
              <EmployeeRowActions employee={employee} onView={onView} onEdit={onEdit} onToggleStatus={onToggleStatus} />
            </StickyCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
