import { call } from "@/lib/services/core";
import type { ServiceResult } from "@/types/common";

export function markNotificationRead(id: string): Promise<ServiceResult<null>> {
  return call<null>("POST", `/api/notifications/${encodeURIComponent(id)}`);
}

export async function markAllNotificationsRead(recipient: string): Promise<ServiceResult<{ count: number }>> {
  void recipient; // the server marks the signed-in user's own notifications
  const result = await call<unknown>("POST", "/api/notifications");
  return result.ok ? { ok: true, data: { count: 0 } } : result;
}
