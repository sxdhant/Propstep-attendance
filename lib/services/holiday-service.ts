import { call } from "@/lib/services/core";
import type { ServiceResult } from "@/types/common";
import type { Holiday } from "@/types/attendance";

/** Marks a date as a day off (or renames the existing one). Admin only. */
export function saveHoliday(holiday: Holiday): Promise<ServiceResult<Holiday>> {
  return call("POST", "/api/holidays", holiday);
}

export function deleteHoliday(date: string): Promise<ServiceResult<Record<string, never>>> {
  return call("DELETE", "/api/holidays", { date });
}
