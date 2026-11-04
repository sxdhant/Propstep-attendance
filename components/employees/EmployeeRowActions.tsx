"use client";

import { Eye, Pencil, Power, PowerOff } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types/employee";

interface EmployeeRowActionsProps {
  employee: Employee;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
  /** Labelled, full-width buttons for the phone card list. */
  fill?: boolean;
}

function IconAction({
  label,
  onClick,
  children,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className={cn(
            tone === "danger" && "text-red-700 hover:bg-red-50 hover:text-red-800",
            tone === "success" && "text-green-700 hover:bg-green-50 hover:text-green-800",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** View profile, edit and (de)activate for one employee, shared by the table and the phone card list. */
export function EmployeeRowActions({ employee, onView, onEdit, onToggleStatus, fill = false }: EmployeeRowActionsProps) {
  const active = employee.status === "active";
  const name = employee.fullName;

  if (fill) {
    return (
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" size="sm" aria-label={`View ${name}'s profile`} onClick={() => onView(employee)}>
          <Eye className="size-3.5" aria-hidden />
          View
        </Button>
        <Button type="button" variant="outline" size="sm" aria-label={`Edit ${name}`} onClick={() => onEdit(employee)}>
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={active ? `Deactivate ${name}` : `Reactivate ${name}`}
          onClick={() => onToggleStatus(employee)}
          className={active ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" : "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"}
        >
          {active ? <PowerOff className="size-3.5" aria-hidden /> : <Power className="size-3.5" aria-hidden />}
          {active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconAction label={`View ${name}'s profile`} onClick={() => onView(employee)}>
        <Eye className="size-4" aria-hidden />
      </IconAction>
      <IconAction label={`Edit ${name}`} onClick={() => onEdit(employee)}>
        <Pencil className="size-4" aria-hidden />
      </IconAction>
      <IconAction
        label={active ? `Deactivate ${name}` : `Reactivate ${name}`}
        onClick={() => onToggleStatus(employee)}
        tone={active ? "danger" : "success"}
      >
        {active ? <PowerOff className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
      </IconAction>
    </div>
  );
}
