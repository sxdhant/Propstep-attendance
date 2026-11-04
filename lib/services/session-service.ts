import { api } from "@/lib/api";
import { dataStore } from "@/lib/data-store";
import { fail, ok } from "@/lib/services/core";
import { sessionStore, toSession } from "@/lib/session-store";
import type { ServiceResult, Session, UserRole } from "@/types/common";

/** Authentication calls. Passwords go to the server over HTTPS and are never stored in the browser. */

interface Me {
  role: UserRole;
  refId: string;
  email: string;
  mustChangePassword: boolean;
  totpEnabled?: boolean;
}

export type SignInOutcome = { requiresTotp: false; session: Session } | { requiresTotp: true; challenge: string };

export async function signInWithCredentials(input: { email: string; password: string }): Promise<ServiceResult<SignInOutcome>> {
  const result = await api<(Me & { requiresTotp: false }) | { requiresTotp: true; challenge: string }>("POST", "/api/auth/login", {
    email: input.email.trim(),
    password: input.password,
  });
  if (!result.ok) return result;
  if (result.data.requiresTotp) return ok({ requiresTotp: true, challenge: result.data.challenge });
  sessionStore.signIn(result.data);
  return ok({ requiresTotp: false, session: toSession(result.data) });
}

/** Second sign-in step: an authenticator code or a recovery code. */
export async function verifyTotpSignIn(challenge: string, code: string): Promise<ServiceResult<Session>> {
  const result = await api<Me>("POST", "/api/auth/verify-totp", { challenge, code });
  if (!result.ok) return result;
  sessionStore.signIn(result.data);
  return ok(toSession(result.data));
}

export async function signOut(): Promise<void> {
  await api("POST", "/api/auth/logout");
  sessionStore.clear();
  dataStore.clear();
}

/** Always succeeds from the user's point of view, so the form can't be used to discover which emails exist. */
export async function requestPasswordReset(email: string): Promise<ServiceResult<{ email: string }>> {
  const result = await api<unknown>("POST", "/api/auth/forgot-password", { email: email.trim() });
  return result.ok ? ok({ email: email.trim() }) : fail(result.error);
}

export function resetPassword(token: string, newPassword: string): Promise<ServiceResult<unknown>> {
  return api("POST", "/api/auth/reset-password", { token, newPassword });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<ServiceResult<unknown>> {
  const result = await api<unknown>("POST", "/api/auth/change-password", { currentPassword, newPassword });
  if (result.ok) sessionStore.update({ mustChangePassword: false });
  return result;
}

/* ------------------------------ devices & 2FA ------------------------------ */

export interface DeviceSession {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
}

export const listDevices = () => api<DeviceSession[]>("GET", "/api/auth/sessions");
export const signOutDevice = (id: string) => api<unknown>("DELETE", "/api/auth/sessions", { id });

export const beginTotpSetup = () => api<{ secret: string; uri: string }>("POST", "/api/auth/totp/setup");

export async function enableTotp(code: string) {
  const result = await api<{ recoveryCodes: string[] }>("POST", "/api/auth/totp/enable", { code });
  if (result.ok) sessionStore.update({ totpEnabled: true });
  return result;
}

export async function disableTotp(password: string, code: string) {
  const result = await api<unknown>("POST", "/api/auth/totp/disable", { password, code });
  if (result.ok) sessionStore.update({ totpEnabled: false });
  return result;
}
