"use client";

import { WEEKDAYS } from "@/lib/constants";
import type { DayEntry } from "@/lib/attendance-utils";
import { getWeekday, monthStart, parseDateKey } from "@/lib/date-utils";
import { formatDate, formatTime } from "@/lib/format";
import { DAY_DISPLAY_META, TONES } from "@/lib/status-config";
import { cn } from "@/lib/utils";
import type { DayDisplayStatus } from "@/types/attendance";

interface AttendanceCalendarProps {
  timeline: DayEntry[];
  year: number;
  month: number;
  selectedDate?: string | null;
  onSelect: (entry: DayEntry) => void;
}

const QUIET_SURFACES: Partial<Record<DayDisplayStatus, string>> = {
  weekly_off: "border-transparent bg-muted/60 text-muted-foreground",
  not_checked_in: "border-primary/40 bg-card text-foreground",
  upcoming: "border-transparent bg-transparent text-muted-foreground/60",
  inactive: "border-transparent bg-transparent text-muted-foreground/40",
};

/** The text a day cell shows beside its number. */
function cellVisibleLabel(entry: DayEntry): string | null {
  if (entry.display === "upcoming" || entry.display === "inactive") return null;
  if (entry.display === "holiday" && entry.holidayName) return entry.holidayName;
  if (entry.display === "not_checked_in") return "Today";
  return DAY_DISPLAY_META[entry.display].label;
}

/**
 * Starts with exactly what is visible ("12 Approved") and then adds the full
 * date and times, so the accessible name always contains the visible text.
 */
function cellLabel(entry: DayEntry): string {
  const visible = cellVisibleLabel(entry);
  const parts = [visible ? `${parseDateKey(entry.date).day} ${visible}` : String(parseDateKey(entry.date).day)];
  parts.push(formatDate(entry.date, "long"));
  if (entry.record?.checkIn) {
    parts.push(`${formatTime(entry.record.checkIn)} to ${formatTime(entry.record.checkOut)}`);
  }
  if (entry.isHalfDay) parts.push("half day");
  return parts.join(", ");
}

function DayCell({
  entry,
  selected,
  onSelect,
}: {
  entry: DayEntry;
  selected: boolean;
  onSelect: (entry: DayEntry) => void;
}) {
  const meta = DAY_DISPLAY_META[entry.display];
  const tone = TONES[meta.tone];
  const Icon = meta.icon;
  const interactive = entry.display !== "upcoming" && entry.display !== "inactive";
  const label = cellVisibleLabel(entry);

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onSelect(entry)}
      aria-label={cellLabel(entry)}
      aria-pressed={selected}
      className={cn(
        "relative flex min-h-[3.75rem] flex-col justify-between rounded-lg border p-1.5 text-left transition-shadow sm:min-h-[4.75rem] sm:p-2",
        QUIET_SURFACES[entry.display] ?? tone.surface,
        interactive && "hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        !interactive && "cursor-default",
        entry.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-card",
        selected && "shadow-sm outline-2 outline-offset-1 outline-primary",
      )}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="text-sm leading-none font-semibold tabular-nums">{parseDateKey(entry.date).day}</span>
        {entry.isHalfDay && (
          <span
            className="rounded bg-cyan-600 px-1 text-[10px] leading-4 font-semibold text-white before:content-['½']"
            title="Half day"
            aria-hidden
          />
        )}
      </span>
      {/* A real space keeps "12" and "Approved" two words for tools that read the cell's visible text. */}
      {entry.display !== "upcoming" && entry.display !== "inactive" && (
        <>
          {" "}
          <span className="hidden max-w-full items-center gap-1 truncate text-[11px] leading-tight font-medium sm:flex">
            <Icon className={cn("size-3 shrink-0", tone.icon)} aria-hidden />
            <span className="truncate">{label}</span>
          </span>
          <Icon className={cn("size-3.5 sm:hidden", tone.icon)} aria-hidden />
        </>
      )}
    </button>
  );
}

const LEGEND: DayDisplayStatus[] = [
  "approved",
  "pending",
  "rejected",
  "incomplete",
  "absent",
  "holiday",
  "weekly_off",
];

export function CalendarLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-2", className)} aria-label="Calendar legend">
      {LEGEND.map((status) => {
        const meta = DAY_DISPLAY_META[status];
        return (
          <li key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-3.5 rounded border", TONES[meta.tone].surface)} aria-hidden />
            {meta.label}
          </li>
        );
      })}
      <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="rounded bg-cyan-600 px-1 text-[10px] leading-4 font-semibold text-white before:content-['½']"
          aria-hidden
        />
        Half day
      </li>
    </ul>
  );
}

export function AttendanceCalendar({ timeline, year, month, selectedDate, onSelect }: AttendanceCalendarProps) {
  const leadingBlanks = getWeekday(monthStart(year, month));

  return (
    <div>
      {/* Every day button announces its own full date and status, so the weekday header is visual only. */}
      <div role="group" aria-label="Monthly attendance calendar" className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((day) => (
          <div key={day.value} className="pb-1 text-center text-xs font-medium text-muted-foreground" aria-hidden>
            <span className="sm:hidden">{day.short.slice(0, 1)}</span>
            <span className="hidden sm:inline">{day.short}</span>
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}
        {timeline.map((entry) => (
          <DayCell key={entry.date} entry={entry} selected={selectedDate === entry.date} onSelect={onSelect} />
        ))}
      </div>
      <CalendarLegend className="mt-4 border-t pt-4" />
    </div>
  );
}
