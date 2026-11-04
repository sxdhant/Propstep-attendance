import { api, type HttpMethod } from "@/lib/api";
import { dataStore } from "@/lib/data-store";
import type { ServiceResult } from "@/types/common";

/**
 * Shared plumbing for the service layer. Every service is `async` and resolves
 * to a `ServiceResult`; components never see HTTP.
 */

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });

export const fail = (error: string): ServiceResult<never> => ({ ok: false, error });

/**
 * Calls the backend and, when it succeeds, re-syncs the data cache so every
 * screen shows the server's truth. Pass `sync: false` for calls that change nothing visible.
 */
export async function call<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: { sync?: boolean } = {},
): Promise<ServiceResult<T>> {
  const result = await api<T>(method, path, body);
  if (result.ok && options.sync !== false) await dataStore.refresh();
  return result;
}
