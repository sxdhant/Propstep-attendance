import { TIMEZONE, TZ_OFFSET } from "@/lib/constants";
import type { DateKey, IsoTimestamp, MonthRef } from "@/types/common";

/**
 * Date handling strategy
 *  - Calendar days are `YYYY-MM-DD` strings in the company timezone. They are
 *    never converted through the browser's local zone, so every viewer sees
 *    the same day regardless of where they open the demo.
 *  - Moments in time are ISO strings that carry the +05:30 offset.
 *  - Arithmetic on day keys is done in UTC, which has no daylight-saving gaps.
 */

const MS_PER_DAY = 86_400_000;
const MAX_RANGE_DAYS = 3_700;

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface IstParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

export function getIstParts(date: Date): IstParts {
  const out: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out as unknown as IstParts;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** The calendar day an instant falls on in the company timezone. */
export function toDateKey(date: Date): DateKey {
  const p = getIstParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Serializes an instant as an IST timestamp (`…+05:30`). */
export function toIstTimestamp(date: Date): IsoTimestamp {
  const p = getIstParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${TZ_OFFSET}`;
}

/** Minutes after midnight (IST) for an instant. */
export function minutesOfDay(date: Date): number {
  const p = getIstParts(date);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Builds an IST timestamp from a day and minutes after midnight (values ≥ 1440 roll into following days). */
export function timestampOn(dateKey: DateKey, minutesAfterMidnight: number): IsoTimestamp {
  const dayOffset = Math.floor(minutesAfterMidnight / 1440);
  const minutes = minutesAfterMidnight - dayOffset * 1440;
  const key = dayOffset ? addDays(dateKey, dayOffset) : dateKey;
  return `${key}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}:00${TZ_OFFSET}`;
}

/** Parses `HH:mm` into minutes after midnight. */
export function parseClockTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

export function makeDateKey(year: number, month: number, day: number): DateKey {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

function toUtcMs(key: DateKey): number {
  const { year, month, day } = parseDateKey(key);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): DateKey {
  const d = new Date(ms);
  return makeDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(key: DateKey, delta: number): DateKey {
  return fromUtcMs(toUtcMs(key) + delta * MS_PER_DAY);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffInDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday. */
export function getWeekday(key: DateKey): number {
  return new Date(toUtcMs(key)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthStart(year: number, month: number): DateKey {
  return makeDateKey(year, month, 1);
}

export function monthEnd(year: number, month: number): DateKey {
  return makeDateKey(year, month, daysInMonth(year, month));
}

/** Inclusive list of day keys between two days. Returns an empty list if `end` precedes `start`. */
export function eachDay(start: DateKey, end: DateKey): DateKey[] {
  const days: DateKey[] = [];
  let cursor = start;
  while (cursor <= end && days.length < MAX_RANGE_DAYS) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function eachDayOfMonth(year: number, month: number): DateKey[] {
  return eachDay(monthStart(year, month), monthEnd(year, month));
}

export function monthOf(key: DateKey): MonthRef {
  const { year, month } = parseDateKey(key);
  return { year, month };
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const index = ref.year * 12 + (ref.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Negative when `a` is earlier than `b`. */
export function compareMonths(a: MonthRef, b: MonthRef): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function monthKey(ref: MonthRef): string {
  return `${ref.year}-${pad2(ref.month)}`;
}

/** Whole minutes between two timestamps, never negative. */
export function minutesBetween(startIso: IsoTimestamp, endIso: IsoTimestamp): number {
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(diff / 60_000));
}

/** Every month from `from` to `to`, inclusive. */
export function eachMonth(from: MonthRef, to: MonthRef): MonthRef[] {
  const months: MonthRef[] = [];
  let cursor = from;
  while (compareMonths(cursor, to) <= 0 && months.length < 240) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}
