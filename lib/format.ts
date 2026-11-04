import { CURRENCIES } from "@/lib/constants";
import { diffInDays, getIstParts, makeDateKey, parseDateKey } from "@/lib/date-utils";
import type { DateKey, IsoTimestamp } from "@/types/common";

/**
 * One place for every user-visible date, time, duration and money format.
 * Dates and months are assembled from fixed English names so output never
 * depends on the visitor's locale or the ICU build.
 */

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = WEEKDAYS_LONG.map((d) => d.slice(0, 3));

export const monthName = (month: number) => MONTHS_LONG[month - 1] ?? "";
export const monthShortName = (month: number) => MONTHS_SHORT[month - 1] ?? "";
export const weekdayName = (weekday: number) => WEEKDAYS_LONG[weekday] ?? "";
export const weekdayShortName = (weekday: number) => WEEKDAYS_SHORT[weekday] ?? "";

function weekdayOf(key: DateKey): number {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export type DateStyle = "short" | "medium" | "long";

/** `30 Oct`, `30 Oct 2026`, or `Friday, 30 October 2026`. */
export function formatDate(key: DateKey, style: DateStyle = "medium"): string {
  const { year, month, day } = parseDateKey(key);
  if (style === "short") return `${day} ${MONTHS_SHORT[month - 1]}`;
  if (style === "long") {
    return `${WEEKDAYS_LONG[weekdayOf(key)]}, ${day} ${MONTHS_LONG[month - 1]} ${year}`;
  }
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

export function formatWeekday(key: DateKey, style: "short" | "long" = "short"): string {
  const weekday = weekdayOf(key);
  return style === "long" ? WEEKDAYS_LONG[weekday] : WEEKDAYS_SHORT[weekday];
}

/** `October 2026`. */
/** "Jun 2024" from a day key. */
export function formatYearMonth(key: DateKey): string {
  const { year, month } = parseDateKey(key);
  return `${monthShortName(month)} ${year}`;
}

export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

/** `Oct 2026`. */
export function formatMonthYearShort(year: number, month: number): string {
  return `${MONTHS_SHORT[month - 1]} ${year}`;
}

const EMPTY = "—";

/** `09:42 AM` in the company timezone. */
export function formatTime(iso: IsoTimestamp | null | undefined): string {
  if (!iso) return EMPTY;
  const { hour, minute } = getIstParts(new Date(iso));
  const h24 = Number(hour);
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${minute} ${h24 < 12 ? "AM" : "PM"}`;
}

/** `09:42:15 AM`, used by the live clock. */
export function formatTimeWithSeconds(date: Date): string {
  const { hour, minute, second } = getIstParts(date);
  const h24 = Number(hour);
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${minute}:${second} ${h24 < 12 ? "AM" : "PM"}`;
}

/** `30 Oct 2026, 09:42 AM`. */
export function formatDateTime(iso: IsoTimestamp | null | undefined): string {
  if (!iso) return EMPTY;
  const p = getIstParts(new Date(iso));
  const key = makeDateKey(Number(p.year), Number(p.month), Number(p.day));
  return `${formatDate(key)}, ${formatTime(iso)}`;
}

/** `8h 42m`, `42m`, or an em dash when there is no duration. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return EMPTY;
  const rounded = Math.max(0, Math.round(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Decimal hours, e.g. `8.7`. */
export function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

/** Whole hours with a thousands separator, for big totals like `1,953h`. */
export function formatHoursCompact(minutes: number): string {
  return `${plainFormatter.format(Math.round(minutes / 60))}h`;
}

/** Relative time for notifications and activity feeds. */
export function formatRelativeTime(iso: IsoTimestamp, nowMs: number): string {
  const diffSeconds = Math.round((nowMs - new Date(iso).getTime()) / 1000);
  if (diffSeconds < 45) return "Just now";
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const p = getIstParts(new Date(iso));
  return formatDate(makeDateKey(Number(p.year), Number(p.month), Number(p.day)), "medium");
}

/* -------------------------------- numbers -------------------------------- */

let activeCurrency = "INR";

/** Called by the mock store whenever the company currency setting changes. */
export function setActiveCurrency(code: string) {
  activeCurrency = code;
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function localeFor(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.locale ?? "en-IN";
}

function currencyFormatter(currency: string, digits: number, compact: boolean): Intl.NumberFormat {
  const cacheKey = `${currency}|${digits}|${compact}`;
  let formatter = currencyFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(localeFor(currency), {
      style: "currency",
      currency,
      minimumFractionDigits: compact ? 0 : digits,
      maximumFractionDigits: compact ? 1 : digits,
      notation: compact ? "compact" : "standard",
    });
    currencyFormatters.set(cacheKey, formatter);
  }
  return formatter;
}

/** `₹27,000`, with Indian digit grouping for INR. Pass `digits: 2` for paise. */
export function formatCurrency(amount: number, options: { digits?: number } = {}): string {
  return currencyFormatter(activeCurrency, options.digits ?? 0, false).format(amount);
}

/** `₹5.2L` style, for chart axes and tight spaces. */
export function formatCompactCurrency(amount: number): string {
  return currencyFormatter(activeCurrency, 0, true).format(amount);
}

const plainFormatter = new Intl.NumberFormat("en-IN");

export function formatNumber(value: number): string {
  return plainFormatter.format(value);
}

/** `22`, `22.5`, `22.25`. Drops trailing zeros. */
export function formatUnits(value: number): string {
  return String(Number.parseFloat(value.toFixed(2)));
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function getCurrencySymbol(): string {
  const part = currencyFormatter(activeCurrency, 0, false)
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? activeCurrency;
}

/* --------------------------------- names --------------------------------- */

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Time since joining, e.g. `2 yrs 3 mo`, `5 mo` or `12 days`. */
export function formatTenure(from: DateKey, to: DateKey): string {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  let months = (end.year - start.year) * 12 + (end.month - start.month);
  if (end.day < start.day) months -= 1;
  if (to < from) return "Not started";
  if (months < 1) return pluralize(diffInDays(to, from), "day");
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? pluralize(years, "yr") : "", rest ? `${rest} mo` : ""].filter(Boolean).join(" ");
}
