"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pagination } from "@/hooks/use-pagination";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps {
  pagination: Pick<Pagination<unknown>, "page" | "pageCount" | "setPage" | "total" | "from" | "to">;
  /** Plural noun for the count, e.g. "employees". */
  noun: string;
  className?: string;
}

/** Page numbers collapse around the current page so long lists stay compact. */
function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

export function DataTablePagination({ pagination, noun, className }: DataTablePaginationProps) {
  const { page, pageCount, setPage, total, from, to } = pagination;
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row",
        className,
      )}
    >
      <p className="text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span> to{" "}
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> {noun}
      </p>

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {pageWindow(page, pageCount).map((item, index) =>
            item === "gap" ? (
              <span key={`gap-${index}`} className="px-1 text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={item === page ? "default" : "ghost"}
                onClick={() => setPage(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                className="min-w-8 tabular-nums"
              >
                {item}
              </Button>
            ),
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
