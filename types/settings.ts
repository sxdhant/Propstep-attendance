import type { DivisorPolicy } from "./payroll";

export interface CompanySettings {
  name: string;
  timezone: string;
  currency: string;
}

export interface AttendancePolicy {
  /** `HH:mm`, 24-hour. */
  officeStartTime: string;
  /** `HH:mm`, 24-hour. */
  officeEndTime: string;
  requiredWorkingHours: number;
  lateGraceMinutes: number;
  /** Minimum hours worked for a day to count as a half day. */
  halfDayThresholdHours: number;
  /** Weekday numbers, 0 = Sunday … 6 = Saturday. */
  weeklyOffs: number[];
}

export interface SalaryPolicy {
  divisorPolicy: DivisorPolicy;
  fixedDivisor: number;
  /** Payable value of one half day. */
  halfDayUnits: number;
  /** Day of the following month on which salaries are paid. */
  payDay: number;
}

export interface AppSettings {
  company: CompanySettings;
  attendance: AttendancePolicy;
  salary: SalaryPolicy;
}
