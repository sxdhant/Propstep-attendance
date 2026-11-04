import type { ComponentProps } from "react";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Cells that stay pinned to the right edge of a horizontally scrolling table,
 * so the row actions are always reachable. They need an opaque fill, because
 * other cells scroll underneath them. Rows must carry the `group/row` class
 * so the pinned cell can follow the row's hover color.
 */
export function StickyHead({ className, ...props }: ComponentProps<typeof TableHead>) {
  return (
    <TableHead
      className={cn("sticky right-0 z-10 bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]", className)}
      {...props}
    />
  );
}

export function StickyCell({ className, ...props }: ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      className={cn(
        "sticky right-0 z-10 bg-card group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]",
        className,
      )}
      {...props}
    />
  );
}
