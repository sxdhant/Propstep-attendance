import { call } from "@/lib/services/core";
import type { ServiceResult } from "@/types/common";
import type { PayrollRecord } from "@/types/payroll";

/** Payroll actions. "Paid" only records a reference the admin typed in; no money moves. */

interface MonthInput {
  year: number;
  month: number;
  /** Ignored: the server records the signed-in administrator. */
  adminId?: string;
}

export interface GenerateSummary {
  created: number;
  refreshed: number;
  /** Lines left untouched because they are already finalized or paid. */
  locked: number;
}

/** Creates a draft for every employee in the month and refreshes existing drafts. */
export function generatePayroll(input: MonthInput): Promise<ServiceResult<GenerateSummary>> {
  return call("POST", "/api/payroll/generate", { year: input.year, month: input.month });
}

export async function finalizePayroll(input: MonthInput & { employeeId: string }): Promise<ServiceResult<PayrollRecord>> {
  const result = await call<{ records: PayrollRecord[] }>("POST", "/api/payroll/finalize", {
    year: input.year,
    month: input.month,
    employeeId: input.employeeId,
  });
  return result.ok ? { ok: true, data: result.data.records[0] } : result;
}

export interface FinalizeAllSummary {
  count: number;
  total: number;
}

/** Finalizes every draft line in a month in one go. */
export async function finalizeAllDrafts(input: MonthInput): Promise<ServiceResult<FinalizeAllSummary>> {
  const result = await call<FinalizeAllSummary & { records: PayrollRecord[] }>("POST", "/api/payroll/finalize", {
    year: input.year,
    month: input.month,
  });
  return result.ok ? { ok: true, data: { count: result.data.count, total: result.data.total } } : result;
}

export function markPayrollPaid(
  input: MonthInput & { employeeId: string; reference: string },
): Promise<ServiceResult<PayrollRecord>> {
  const id = `${input.employeeId}_${input.year}-${String(input.month).padStart(2, "0")}`;
  return call("POST", `/api/payroll/${encodeURIComponent(id)}/pay`, { reference: input.reference });
}
