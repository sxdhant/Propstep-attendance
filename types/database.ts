import type { AttendanceRecord, Holiday } from "./attendance";
import type { IsoTimestamp } from "./common";
import type { AdminUser, Employee } from "./employee";
import type { AppNotification } from "./notification";
import type { PayrollRecord } from "./payroll";
import type { AppSettings } from "./settings";

/**
 * The complete client-side mock database. In the backend phase each
 * collection becomes a table or collection behind an API; the UI never
 * touches this shape directly, only through selectors and services.
 */
export interface Database {
  version: number;
  seededAt: IsoTimestamp;
  /** Milliseconds added to the real clock so the demo can fast-forward. */
  clockOffsetMs: number;
  settings: AppSettings;
  admins: AdminUser[];
  employees: Employee[];
  /** Keyed by `AttendanceRecord.id`. */
  attendance: Record<string, AttendanceRecord>;
  /** Keyed by `PayrollRecord.id`. */
  payroll: Record<string, PayrollRecord>;
  notifications: AppNotification[];
  holidays: Holiday[];
}
