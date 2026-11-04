import type { LucideIcon } from "lucide-react";
import { SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

/** An empty screen is an invitation: say what is missing and what to do next. */
export function EmptyState({ title, description, icon: Icon = SearchX, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
