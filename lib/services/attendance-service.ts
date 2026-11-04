import type { BackfillEntry } from "@/lib/backfill";
import { call } from "@/lib/services/core";
import type { AttendanceRecord } from "@/types/attendance";
import type { ServiceResult } from "@/types/common";

/**
 * Employee actions. The time of a check-in or check-out is taken by the server
 * from its own clock; the browser never supplies it.
 */

export function checkIn(input: { employeeId: string }): Promise<ServiceResult<AttendanceRecord>> {
  void input; // the server identifies the employee from the session
  return call("POST", "/api/attendance/check-in");
}

export function checkOut(input: { employeeId: string }): Promise<ServiceResult<AttendanceRecord>> {
  void input;
  return call("POST", "/api/attendance/check-out");
}

/* ------------------------------ admin decisions ------------------------------ */

export interface ReviewInput {
  recordId: string;
  decision: "approve" | "reject";
  /** Ignored: the server records the signed-in administrator. */
  adminId?: string;
  /** Required when rejecting. */
  reason?: string;
  /** Required when approving an incomplete day: how many payable days it should count as. */
  payableAs?: "full" | "half";
}

export function reviewAttendance(input: ReviewInput): Promise<ServiceResult<AttendanceRecord>> {
  const body =
    input.decision === "approve"
      ? { decision: "approve", payableAs: input.payableAs }
      : { decision: "reject", reason: input.reason };
  return call("POST", `/api/attendance/${encodeURIComponent(input.recordId)}/review`, body);
}

/* -------------------------------- backfill -------------------------------- */

export interface BackfillRowResult {
  index: number;
  employeeId: string;
  date: string;
  ok: boolean;
  action?: "save" | "clear";
  error?: string;
}

export interface BackfillPreview {
  dryRun: true;
  results: BackfillRowResult[];
  summary: { rows: number; errors: number; toSave: number; toClear: number };
}

export interface BackfillDone {
  dryRun: false;
  created: number;
  updated: number;
  cleared: number;
  employees: number;
}

/** Checks rows against the rules without saving anything. */
export function previewBackfill(entries: BackfillEntry[]): Promise<ServiceResult<BackfillPreview>> {
  return call("POST", "/api/attendance/backfill", { entries, dryRun: true }, { sync: false });
}

/** Saves every row (all-or-nothing) and refreshes the data cache. */
export function saveBackfill(entries: BackfillEntry[]): Promise<ServiceResult<BackfillDone>> {
  return call("POST", "/api/attendance/backfill", { entries });
}
