import { call } from "@/lib/services/core";
import type { ServiceResult } from "@/types/common";
import type { AppSettings } from "@/types/settings";

/** Saves one settings section. The server validates it, stores it and notifies employees when attendance rules change. */
export function saveSettings<K extends keyof AppSettings>(
  section: K,
  values: AppSettings[K],
): Promise<ServiceResult<AppSettings>> {
  return call("PUT", `/api/settings/${section}`, values);
}
