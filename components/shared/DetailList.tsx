import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Skips the row entirely, so callers can list optional fields inline. */
  hidden?: boolean;
}

interface DetailListProps {
  items: DetailItem[];
  className?: string;
}

/** Label/value rows for dialogs and drawers. */
export function DetailList({ items, className }: DetailListProps) {
  return (
    <dl className={cn("divide-y text-sm", className)}>
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-6 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
            <dd className="min-w-0 text-right font-medium text-foreground">{item.value}</dd>
          </div>
        ))}
    </dl>
  );
}
