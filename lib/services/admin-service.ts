import { call } from "@/lib/services/core";
import type { ServiceResult } from "@/types/common";
import type { AdminUser } from "@/types/employee";
import type { AdminProfileValues } from "@/lib/validation/schemas";

/** Saves the signed-in administrator's own profile. */
export function saveAdminProfile(values: AdminProfileValues): Promise<ServiceResult<AdminUser>> {
  return call("PATCH", "/api/admin/profile", values);
}
