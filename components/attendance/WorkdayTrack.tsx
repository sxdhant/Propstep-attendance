import { parseClockTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface WorkdayTrackProps {
  /** `HH:mm` office start. */
  officeStartTime: string;
  /** `HH:mm` office close. */
  officeEndTime: string;
  nowMinutes: number;
  checkInMinutes: number | null;
  checkOutMinutes: number | null;
  showNow?: boolean;
  className?: string;
}

const PADDING_MINUTES = 90;

const percent = (value: number, from: number, to: number) =>
  Math.min(100, Math.max(0, ((value - from) / (to - from)) * 100));

function formatHour(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 || 12;
  return `${h12} ${h24 < 12 ? "AM" : "PM"}`;
}

/**
 * A horizontal strip of the day: office hours as a lighter band, time at
 * work as a bright fill, and a marker for "now". It answers "where am I in
 * the working day?" at a glance.
 */
export function WorkdayTrack({
  officeStartTime,
  officeEndTime,
  nowMinutes,
  checkInMinutes,
  checkOutMinutes,
  showNow = true,
  className,
}: WorkdayTrackProps) {
  const officeStart = parseClockTime(officeStartTime);
  const officeEnd = parseClockTime(officeEndTime);
  const from = Math.max(0, officeStart - PADDING_MINUTES);
  const to = Math.min(1440, officeEnd + PADDING_MINUTES);

  const workedFrom = checkInMinutes === null ? null : percent(checkInMinutes, from, to);
  const workedTo = checkInMinutes === null ? null : percent(checkOutMinutes ?? nowMinutes, from, to);

  // Hour ticks every 3 hours keep the strip readable on narrow screens.
  const ticks: number[] = [];
  for (let m = Math.ceil(from / 180) * 180; m <= to; m += 180) ticks.push(m);

  return (
    <div className={className}>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/25"
          style={{
            left: `${percent(officeStart, from, to)}%`,
            width: `${percent(officeEnd, from, to) - percent(officeStart, from, to)}%`,
          }}
          title={`Office hours ${officeStartTime} to ${officeEndTime}`}
        />
        {workedFrom !== null && workedTo !== null && workedTo > workedFrom && (
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sky-300"
            style={{ left: `${workedFrom}%`, width: `${workedTo - workedFrom}%` }}
          />
        )}
        {checkInMinutes !== null && (
          <span
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300 ring-2 ring-ink"
            style={{ left: `${percent(checkInMinutes, from, to)}%` }}
            title="Checked in"
          />
        )}
        {checkOutMinutes !== null && (
          <span
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-ink"
            style={{ left: `${percent(checkOutMinutes, from, to)}%` }}
            title="Checked out"
          />
        )}
        {showNow && nowMinutes >= from && nowMinutes <= to && (
          <span
            className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            style={{ left: `${percent(nowMinutes, from, to)}%` }}
            title="Now"
          />
        )}
      </div>

      <div className="relative h-4 text-[11px] text-white/50" aria-hidden>
        {ticks.map((tick) => (
          <span
            key={tick}
            className={cn("absolute -translate-x-1/2 tabular-nums")}
            style={{ left: `${percent(tick, from, to)}%` }}
          >
            {formatHour(tick)}
          </span>
        ))}
      </div>
    </div>
  );
}
