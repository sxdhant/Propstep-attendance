"use client";

import type { ReactNode } from "react";

interface TooltipItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: { fill?: string } & Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipItem>;
  label?: string | number;
  /** Heading shown above the rows. Defaults to the axis label. */
  title?: (label: string | number | undefined, items: ReadonlyArray<TooltipItem>) => ReactNode;
  format?: (value: number, item: TooltipItem) => string;
  /** Series colors by `dataKey`; stacked bars draw a surface-colored stroke, so payload colors can't be trusted. */
  colors?: Record<string, string>;
  /** Series names by `dataKey`, overriding the payload name. */
  names?: Record<string, string>;
  showTotal?: boolean;
  /** List rows top-to-bottom in the reverse of series order, matching how a stack reads. */
  reverse?: boolean;
  hideZero?: boolean;
}

/**
 * One tooltip for every chart: it lists every series at the hovered position,
 * values first and names second, with short line-keys instead of boxes.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  title,
  format = (value) => String(value),
  colors,
  names,
  showTotal = false,
  reverse = false,
  hideZero = false,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  let items = [...payload].filter((item) => typeof item.value === "number" || item.value !== undefined);
  if (hideZero) items = items.filter((item) => Number(item.value) !== 0);
  if (reverse) items.reverse();
  const total = items.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{title ? title(label, payload) : label}</p>
      <ul className="space-y-1">
        {items.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const color = colors?.[key] ?? item.payload?.fill ?? item.color ?? "#7b8794";
          const name = names?.[key] ?? String(item.name ?? key);
          return (
            <li key={key} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                {name}
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                {format(Number(item.value ?? 0), item)}
              </span>
            </li>
          );
        })}
      </ul>
      {showTotal && items.length > 1 && (
        <div className="mt-1.5 flex items-center justify-between gap-6 border-t pt-1.5">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold text-foreground tabular-nums">{format(total, { value: total })}</span>
        </div>
      )}
    </div>
  );
}
