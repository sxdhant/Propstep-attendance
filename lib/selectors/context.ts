import { buildHolidayMap, type AttendanceContext } from "@/lib/attendance-utils";
import { monthOf, shiftMonth, toDateKey } from "@/lib/date-utils";
import type { MonthRef } from "@/types/common";
import type { Database } from "@/types/database";

/** Months of attendance history the seed generates before the month it was created in. */
export const SEEDED_HISTORY_MONTHS = 3;

/**
 * The earliest month that has meaningful attendance data. Months before it
 * would show every working day as an absence, so pickers and history lists
 * stop here.
 */
export function getDataWindowStart(db: Database): MonthRef {
  return shiftMonth(monthOf(db.seededAt.slice(0, 10)), -SEEDED_HISTORY_MONTHS);
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
