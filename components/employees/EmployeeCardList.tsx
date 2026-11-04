"use client";

import { EmployeeRowActions } from "@/components/employees/EmployeeRowActions";
import { ProfileStatusBadge } from "@/components/profile/ProfileStatusBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatCurrency, formatDate } from "@/lib/format";
import { getProfileStatus } from "@/lib/profile-utils";
import { ACCOUNT_STATUS_META } from "@/lib/status-config";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types/employee";

interface EmployeeCardListProps {
  employees: Employee[];
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
}

/** The employee table reshaped for phones: one card per person. */
export function EmployeeCardList({ employees, onView, onEdit, onToggleStatus }: EmployeeCardListProps) {
  return (
    <ul className="divide-y">
      {employees.map((employee) => (
        <li key={employee.id} className={cn("space-y-3 p-4", employee.status === "inactive" && "bg-muted/20")}>
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => onView(employee)}
              className="flex min-w-0 items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="md" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{employee.fullName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {employee.id}, {employee.designation}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge meta={ACCOUNT_STATUS_META[employee.status]} />
              {getProfileStatus(employee) !== "complete" && <ProfileStatusBadge employee={employee} />}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Department</dt>
              <dd className="mt-0.5 font-medium text-foreground">{employee.department}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Monthly basic</dt>
              <dd className="mt-0.5 font-medium text-foreground">{formatCurrency(employee.monthlyBasicSalary)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5 truncate font-medium text-foreground" title={employee.email}>
                {employee.email}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="mt-0.5 font-medium text-foreground">{formatDate(employee.joiningDate)}</dd>
            </div>
          </dl>

          <EmployeeRowActions employee={employee} onView={onView} onEdit={onEdit} onToggleStatus={onToggleStatus} fill />
        </li>
      ))}
    </ul>
  );
}
