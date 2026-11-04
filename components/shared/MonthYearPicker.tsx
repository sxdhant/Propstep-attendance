"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compareMonths, shiftMonth } from "@/lib/date-utils";
import { monthName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthRef } from "@/types/common";

interface MonthYearPickerProps {
  value: MonthRef;
  onChange: (value: MonthRef) => void;
  /** Earliest selectable month. Defaults to two years before `max`. */
  min?: MonthRef;
  /** Latest selectable month. */
  max: MonthRef;
  className?: string;
}

/** Month and year selectors with previous/next arrows, bounded to the months that have data. */
export function MonthYearPicker({ value, onChange, min, max, className }: MonthYearPickerProps) {
  const lowest = min ?? { year: max.year - 2, month: 1 };
  const years = Array.from({ length: max.year - lowest.year + 1 }, (_, i) => lowest.year + i);

  const clamp = (next: MonthRef): MonthRef => {
    if (compareMonths(next, max) > 0) return max;
    if (compareMonths(next, lowest) < 0) return lowest;
    return next;
  };

  const canGoBack = compareMonths(value, lowest) > 0;
  const canGoForward = compareMonths(value, max) < 0;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous month"
        disabled={!canGoBack}
        onClick={() => onChange(shiftMonth(value, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Select
        value={String(value.month)}
        onValueChange={(month) => onChange(clamp({ year: value.year, month: Number(month) }))}
      >
        <SelectTrigger aria-label="Month" className="w-[8.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const candidate = { year: value.year, month };
            const disabled = compareMonths(candidate, max) > 0 || compareMonths(candidate, lowest) < 0;
            return (
              <SelectItem key={month} value={String(month)} disabled={disabled}>
                {monthName(month)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Select
        value={String(value.year)}
        onValueChange={(year) => onChange(clamp({ year: Number(year), month: value.month }))}
      >
        <SelectTrigger aria-label="Year" className="w-[5.75rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next month"
        disabled={!canGoForward}
        onClick={() => onChange(shiftMonth(value, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
