"use client";

import { ChartColumn, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

export interface LegendItem {
  label: string;
  color: string;
  /** Optional figure shown beside the label, e.g. a count. */
  value?: ReactNode;
}

export interface ChartTable {
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Array<Record<string, ReactNode>>;
}

interface ChartCardProps {
  title: string;
  description?: string;
  /** Required whenever the chart has two or more series. */
  legend?: LegendItem[];
  /** The same numbers as the chart, for readers who can't use hover or color. */
  table?: ChartTable;
  actions?: ReactNode;
  /** Shown instead of the chart when there is nothing to plot. */
  empty?: { title: string; description?: string } | null;
  children: ReactNode;
  className?: string;
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)} aria-label="Legend">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} aria-hidden />
          <span>{item.label}</span>
          {item.value !== undefined && <span className="font-medium text-foreground tabular-nums">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** A titled chart panel with an optional table view of the same data. */
export function ChartCard({
  title,
  description,
  legend,
  table,
  actions,
  empty,
  children,
  className,
}: ChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const showTable = view === "table" && table;

  return (
    <section className={cn("rounded-xl bg-card shadow-xs ring-1 ring-foreground/10", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {table && !empty && (
            <div role="group" aria-label={`${title} view`} className="inline-flex rounded-md bg-muted p-0.5">
              {(
                [
                  ["chart", ChartColumn, "Chart"],
                  ["table", Table2, "Table"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    view === value
                      ? "bg-card text-foreground shadow-xs ring-1 ring-foreground/10"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {legend && legend.length > 0 && !showTable && !empty && <Legend items={legend} className="px-5 pt-3" />}

      <div className="px-5 pt-4 pb-5">
        {empty ? (
          <EmptyState title={empty.title} description={empty.description} className="py-10" />
        ) : showTable ? (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                <tr>
                  {table.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        "px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground",
                        column.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((row, index) => (
                  <tr key={index}>
                    {table.columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-3 py-2 whitespace-nowrap",
                          column.align === "right" ? "text-right tabular-nums" : "text-left",
                        )}
                      >
                        {row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
