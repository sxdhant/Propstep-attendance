import type { Employee } from "./employee";
import type { IsoTimestamp } from "./common";

export type PayrollStatus = "draft" | "finalized" | "paid";

export type DivisorPolicy = "scheduled_working_days" | "calendar_days" | "fixed";

/** Output of the (demonstration) salary formula. */
export interface SalaryCalculation {
  monthlyBasicSalary: number;
  scheduledWorkingDays: number;
  calendarDays: number;
  divisorPolicy: DivisorPolicy;
  divisor: number;
  approvedFullDays: number;
  approvedHalfDays: number;
  /** Paid comp-off days taken (each counts as one payable day). Absent on older records. */
  compOffDays?: number;
  /** Payable value of one half day (0.5 by default). */
  halfDayUnits: number;
  /** Approved full days + approved half days × halfDayUnits. */
  payableUnits: number;
  /** Basic salary ÷ divisor. */
  perDayRate: number;
  estimatedSalary: number;
  /** True when the raw result exceeded the basic salary and was capped. */
  cappedAtBasic: boolean;
}

/** Salary calculation plus the attendance buckets that explain it. */
export interface PayrollSnapshot extends SalaryCalculation {
  pendingDays: number;
  rejectedDays: number;
  incompleteDays: number;
  absentDays: number;
  /** Absent + rejected + incomplete: scheduled days that earn nothing. */
  unpaidDays: number;
}

export interface PayrollRecord {
  /** Deterministic key: `${employeeId}_${year}-${MM}`. */
  id: string;
  employeeId: string;
  year: number;
  month: number;
  status: PayrollStatus;
  generatedAt: IsoTimestamp;
  finalizedAt?: IsoTimestamp;
  finalizedBy?: string;
  paidAt?: IsoTimestamp;
  paymentReference?: string;
  /** Figures frozen when the record was finalized. Drafts always use live figures. */
  snapshot?: PayrollSnapshot;
}

/** Everything a payroll table row needs, whether or not a record exists yet. */
export interface PayrollRow {
  employee: Employee;
  year: number;
  month: number;
  status: PayrollStatus | "not_generated";
  record: PayrollRecord | null;
  figures: PayrollSnapshot;
  /** True when figures come from current attendance rather than a frozen snapshot. */
  isLive: boolean;
}
