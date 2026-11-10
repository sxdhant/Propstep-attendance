import { buildHolidayMap, type AttendanceContext } from "@/lib/attendance-utils";
import { compareMonths, monthOf, shiftMonth, toDateKey } from "@/lib/date-utils";
import type { MonthRef } from "@/types/common";
import type { Database } from "@/types/database";

/** Months of attendance history the seed generates before the month it was created in. */
export const SEEDED_HISTORY_MONTHS = 3;

/** First month an administrator can enter past attendance for. */
const HISTORY_START: MonthRef = { year: 2026, month: 5 };

/**
 * The earliest month that has meaningful attendance data. Months before it
 * would show every working day as an absence, so pickers and history lists
 * stop here.
 */
export function getDataWindowStart(db: Database): MonthRef {
  const seeded = shiftMonth(monthOf(db.seededAt.slice(0, 10)), -SEEDED_HISTORY_MONTHS);
  // Past attendance can be entered from May 2026, so month pickers must reach back that far.
  return compareMonths(seeded, HISTORY_START) > 0 ? HISTORY_START : seeded;
}

/** Current demo time: the real clock plus the fast-forward offset. Call from handlers, not render. */
export function getDemoNowMs(db: Database): number {
  return Date.now() + db.clockOffsetMs;
}

export function createAttendanceContext(db: Database, nowMs: number): AttendanceContext {
  return {
    today: toDateKey(new Date(nowMs)),
    nowMs,
    policy: db.settings.attendance,
    holidays: buildHolidayMap(db.holidays),
  };
}
