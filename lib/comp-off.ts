import type { AttendanceRecord } from "@/types/attendance";

/**
 * Comp-off: working on a company holiday earns a day off, taken later on any day.
 * The holiday work itself is not paid again; the comp-off day is a paid day.
 * An approved full day earns 1, an approved half day earns 0.5. Taking one uses 1.
 */

type Slim = Pick<AttendanceRecord, "date" | "status" | "approval">;

export interface CompOffBalance {
  earned: number;
  taken: number;
  balance: number;
}

/** How much comp-off a single record on a holiday earns (0 when it isn't an approved day of work). */
export function compOffEarnedBy(record: Slim, isHoliday: boolean): number {
  if (!isHoliday || record.approval !== "approved") return 0;
  if (record.status === "present") return 1;
  if (record.status === "half_day") return 0.5;
  return 0;
}

export function computeCompOffBalance(records: Slim[], holidays: Record<string, string>): CompOffBalance {
  let earned = 0;
  let taken = 0;
  for (const record of records) {
    earned += compOffEarnedBy(record, Boolean(holidays[record.date]));
    if (record.status === "comp_off") taken += 1;
  }
  return { earned, taken, balance: earned - taken };
}
