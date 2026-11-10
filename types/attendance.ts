import type { DateKey, IsoTimestamp } from "./common";

/** Statuses that can be stored on an attendance record. */
export type RecordStatus =
  | "present"
  | "half_day"
  | "absent"
  | "incomplete"
  | "in_progress"
  /** An employee's own day off, chosen by the admin. Not an absence and not counted as a working day. */
  | "week_off"
  /** A paid day off taken against comp-off earned by working on a holiday. */
  | "comp_off";

/**
 * What a calendar day resolves to for display. Adds the calendar-driven states
 * (holiday, weekly off) that never need a stored record.
 */
export type AttendanceStatus =
  | RecordStatus
  | "holiday"
  | "weekly_off"
  | "not_checked_in";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "not_required";

/** One employee's attendance for one calendar day. */
export interface AttendanceRecord {
  /** Deterministic key: `${employeeId}_${date}`. */
  id: string;
  employeeId: string;
  date: DateKey;
  checkIn: IsoTimestamp | null;
  checkOut: IsoTimestamp | null;
  status: RecordStatus;
  approval: ApprovalStatus;
  remarks?: string;
  rejectionReason?: string;
  reviewedAt?: IsoTimestamp;
  /** Admin id of the reviewer. */
  reviewedBy?: string;
  /** Free-text note added when an admin regularizes an incomplete record. */
  reviewNote?: string;
}

export interface Holiday {
  date: DateKey;
  name: string;
}

/** Collapsed status used for calendar cells and the status legend. */
export type DayDisplayStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "absent"
  | "incomplete"
  | "in_progress"
  | "holiday"
  | "weekly_off"
  | "comp_off"
  | "not_checked_in"
  | "upcoming"
  | "inactive";

/** Statuses plotted in dashboard and report charts, in the fixed (colorblind-validated) stack order. */
export type ChartStatus = "approved" | "absent" | "pending" | "rejected" | "incomplete";
