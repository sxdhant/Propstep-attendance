import type { ServiceResult } from "@/types/common";

/**
 * The one place the browser talks to the backend. Every service resolves to a
 * `ServiceResult`, so components never deal with HTTP details.
 *
 * Session cookies are httpOnly, so no token ever touches JavaScript.
 */

type Hooks = { onUnauthorized?: () => void; onPasswordChangeRequired?: () => void };
const hooks: Hooks = {};

/** Lets the session store react to an expired session without a circular import. */
export function setApiHooks(next: Hooks) {
  Object.assign(hooks, next);
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function api<T>(method: HttpMethod, path: string, body?: unknown): Promise<ServiceResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as
      | { ok: true; data: T }
      | { ok: false; error?: string; code?: string }
      | null;

    if (json?.ok) return { ok: true, data: json.data };

    // A 401 on a sign-in attempt just means "wrong credentials"; anywhere else it means the session ended.
    if (response.status === 401 && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/verify-totp")) {
      hooks.onUnauthorized?.();
    }
    if (json && !json.ok && json.code === "PASSWORD_CHANGE_REQUIRED") hooks.onPasswordChangeRequired?.();

    return { ok: false, error: (json && !json.ok && json.error) || `The server returned an error (${response.status}).` };
  } catch {
    return { ok: false, error: "Can't reach the server. Check your connection and try again." };
  }
}
