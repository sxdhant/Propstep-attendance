import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { audit } from "@/lib/server/audit";
import { query, queryOne, transaction } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { decryptSecret, encryptSecret } from "@/lib/server/crypto";
import { mailPasswordReset } from "@/lib/server/mail-templates";
import { checkPasswordPolicy, hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/server/passwords";
import { getRequestInfo } from "@/lib/server/request";
import { generateSecret, otpauthUri, verifyCode } from "@/lib/server/totp";
import type { UserRole } from "@/types/common";

/**
 * Session model
 *  - 256-bit random token in an httpOnly, SameSite=Lax cookie (`__Host-` prefixed and Secure in production).
 *  - Only SHA-256(token) is stored, so a database leak can't be turned into live cookies.
 *  - Absolute lifetime 7 days, idle timeout 12 hours, at most 5 concurrent sessions per user.
 *  - Password change / reset revokes every session.
 */

const COOKIE = env.isProd ? "__Host-session" : "session";
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_MS = 12 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 5;

const ATTEMPT_WINDOW_MIN = 15;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export interface AuthUser {
  userId: string;
  sessionId: string;
  role: UserRole;
  /** Employee id for employees, admin id for admins. */
  refId: string;
  email: string;
  mustChangePassword: boolean;
  totpEnabled: boolean;
}

interface UserRow {
  id: string;
  role: UserRole;
  email: string;
  password_hash: string;
  ref_id: string;
  must_change_password: boolean;
  disabled: boolean;
  totp_secret: string | null;
  totp_enabled: boolean;
  totp_last_step: string | null;
}

async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: ABSOLUTE_MS / 1000,
  });
}

async function createSession(userId: string): Promise<void> {
  const { ip, userAgent } = await getRequestInfo();
  const token = newToken();
  await transaction(async (tx) => {
    await query(
      "INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent) VALUES ($1,$2, now() + $3 * interval '1 millisecond', $4,$5)",
      [sha256(token), userId, ABSOLUTE_MS, ip, userAgent],
      tx,
    );
    // Keep only the newest MAX_SESSIONS; also sweep expired rows.
    await query(
      `DELETE FROM sessions WHERE user_id = $1 AND id NOT IN
         (SELECT id FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2)`,
      [userId, MAX_SESSIONS],
      tx,
    );
    await query("DELETE FROM sessions WHERE expires_at < now()", [], tx);
  });
  await setSessionCookie(token);
}

/* --------------------------------- sign in --------------------------------- */

async function recentFailures(key: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    "SELECT count(*) AS n FROM login_attempts WHERE key = $1 AND at > now() - $2 * interval '1 minute'",
    [key, ATTEMPT_WINDOW_MIN],
  );
  return Number(row?.n ?? 0);
}

async function recordFailure(email: string, ip: string) {
  await query("INSERT INTO login_attempts (key) VALUES ($1), ($2)", [`email:${email}`, `ip:${ip}`]);
  await query("DELETE FROM login_attempts WHERE at < now() - interval '1 day'");
}

type PublicUser = Pick<AuthUser, "role" | "refId" | "email" | "mustChangePassword">;

export type SignInResult =
  | { ok: true; requiresTotp: false; user: PublicUser }
  | { ok: true; requiresTotp: true; challenge: string }
  | { ok: false; status: number; error: string };

const CHALLENGE_TTL_MIN = 5;
const MAX_CHALLENGE_ATTEMPTS = 5;

async function completeLogin(user: UserRow, email: string): Promise<PublicUser> {
  await query("DELETE FROM login_attempts WHERE key = $1", [`email:${email}`]);
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await createSession(user.id); // a brand-new token on every login prevents session fixation
  await audit("login.success", { actorUserId: user.id });
  return { role: user.role, refId: user.ref_id, email: user.email, mustChangePassword: user.must_change_password };
}

export async function signIn(emailInput: string, password: string): Promise<SignInResult> {
  const email = emailInput.trim().toLowerCase();
  const { ip } = await getRequestInfo();

  // Limits are keyed on the typed email whether or not it exists, so they reveal nothing about accounts.
  if ((await recentFailures(`email:${email}`)) >= MAX_FAILS_PER_EMAIL || (await recentFailures(`ip:${ip}`)) >= MAX_FAILS_PER_IP) {
    await audit("login.throttled", { target: email });
    return { ok: false, status: 429, error: `Too many failed attempts. Try again in ${ATTEMPT_WINDOW_MIN} minutes.` };
  }

  const user = await queryOne<UserRow>("SELECT * FROM users WHERE lower(email) = $1", [email]);
  const valid = user ? await verifyPassword(password, user.password_hash) : (await verifyAgainstDummy(password), false);
  if (!user || !valid) {
    await recordFailure(email, ip);
    await audit("login.failed", { actorUserId: user?.id, target: email });
    return { ok: false, status: 401, error: "Incorrect email or password." };
  }

  if (user.disabled) {
    await audit("login.blocked", { actorUserId: user.id, meta: { reason: "disabled" } });
    return { ok: false, status: 403, error: "This account has been deactivated. Please contact your administrator." };
  }
  if (user.role === "employee") {
    const emp = await queryOne<{ status: string }>("SELECT status FROM employees WHERE id = $1", [user.ref_id]);
    if (emp?.status !== "active") {
      await audit("login.blocked", { actorUserId: user.id, meta: { reason: "inactive" } });
      return { ok: false, status: 403, error: "This account has been deactivated. Please contact your administrator." };
    }
  }

  if (user.totp_enabled) {
    // Password was right, but no session exists until the second factor is proven.
    const challenge = newToken();
    await query("DELETE FROM login_challenges WHERE user_id = $1 OR expires_at < now()", [user.id]);
    await query(
      "INSERT INTO login_challenges (token_hash, user_id, expires_at) VALUES ($1,$2, now() + $3 * interval '1 minute')",
      [sha256(challenge), user.id, CHALLENGE_TTL_MIN],
    );
    await audit("login.password_ok_totp_required", { actorUserId: user.id });
    return { ok: true, requiresTotp: true, challenge };
  }
  return { ok: true, requiresTotp: false, user: await completeLogin(user, email) };
}

/** Second step of sign-in: a 6-digit authenticator code or a one-time recovery code. */
export async function verifyTotpLogin(
  challenge: string,
  code: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; status: number; error: string }> {
  const bad = { ok: false as const, status: 401, error: "That code isn't right. Try again." };
  const row = await queryOne<{ id: string; user_id: string; attempts: number }>(
    "SELECT id, user_id, attempts FROM login_challenges WHERE token_hash = $1 AND expires_at > now()",
    [sha256(challenge)],
  );
  if (!row) return { ok: false, status: 401, error: "Your sign-in expired. Please start again." };
  if (row.attempts >= MAX_CHALLENGE_ATTEMPTS) {
    await query("DELETE FROM login_challenges WHERE id = $1", [row.id]);
    return { ok: false, status: 429, error: "Too many incorrect codes. Please sign in again." };
  }
  await query("UPDATE login_challenges SET attempts = attempts + 1 WHERE id = $1", [row.id]);

  const user = await queryOne<UserRow>("SELECT * FROM users WHERE id = $1 AND NOT disabled", [row.user_id]);
  if (!user || !user.totp_secret) return bad;

  const cleaned = code.replace(/\s|-/g, "");
  let accepted = false;
  if (/^\d{6}$/.test(cleaned)) {
    const step = verifyCode(decryptSecret(user.totp_secret), cleaned, user.totp_last_step === null ? null : Number(user.totp_last_step));
    if (step !== null) {
      // Conditional update: the same code can't be replayed, even by two simultaneous requests.
      const claimed = await query(
        "UPDATE users SET totp_last_step = $1 WHERE id = $2 AND (totp_last_step IS NULL OR totp_last_step < $1) RETURNING id",
        [step, user.id],
      );
      accepted = claimed.length > 0;
    }
  } else {
    const used = await query(
      "UPDATE recovery_codes SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL RETURNING id",
      [user.id, sha256(cleaned.toLowerCase())],
    );
    accepted = used.length > 0;
    if (accepted) await audit("totp.recovery_code_used", { actorUserId: user.id });
  }
  if (!accepted) {
    await audit("login.totp_failed", { actorUserId: user.id });
    return bad;
  }
  await query("DELETE FROM login_challenges WHERE id = $1", [row.id]);
  return { ok: true, user: await completeLogin(user, user.email.toLowerCase()) };
}

/* ------------------------------ two-factor setup ----------------------------- */

const RECOVERY_CODE_COUNT = 8;

/** Starts enrollment. Nothing is active until a code from the app is confirmed. */
export async function beginTotpSetup(user: AuthUser): Promise<{ secret: string; uri: string }> {
  const secret = generateSecret();
  await query("UPDATE users SET totp_secret = $1, totp_enabled = false, totp_last_step = NULL WHERE id = $2", [encryptSecret(secret), user.userId]);
  return { secret, uri: otpauthUri(secret, user.email, "Propstep") };
}

export async function enableTotp(
  user: AuthUser,
  code: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; status: number; error: string }> {
  const row = await queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [user.userId]);
  if (!row?.totp_secret || row.totp_enabled) return { ok: false, status: 409, error: "Start two-factor setup first." };
  const step = verifyCode(decryptSecret(row.totp_secret), code.replace(/\s/g, ""), null);
  if (step === null) return { ok: false, status: 422, error: "That code isn't right. Check the app and try again." };

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomBytes(5).toString("hex"));
  await transaction(async (tx) => {
    await query("UPDATE users SET totp_enabled = true, totp_last_step = $1 WHERE id = $2", [step, user.userId], tx);
    await query("DELETE FROM recovery_codes WHERE user_id = $1", [user.userId], tx);
    for (const c of codes) await query("INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1,$2)", [user.userId, sha256(c)], tx);
    await query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [user.userId, user.sessionId], tx);
  });
  await audit("totp.enabled", { actorUserId: user.userId });
  return { ok: true, recoveryCodes: codes };
}

export async function disableTotp(
  user: AuthUser,
  password: string,
  code: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const row = await queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [user.userId]);
  if (!row || !row.totp_enabled || !row.totp_secret) return { ok: false, status: 409, error: "Two-factor sign-in isn't turned on." };
  if (!(await verifyPassword(password, row.password_hash))) return { ok: false, status: 403, error: "Your password is incorrect." };
  if (verifyCode(decryptSecret(row.totp_secret), code.replace(/\s/g, ""), row.totp_last_step === null ? null : Number(row.totp_last_step)) === null) {
    return { ok: false, status: 422, error: "That code isn't right." };
  }
  await query("UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_last_step = NULL WHERE id = $1", [user.userId]);
  await query("DELETE FROM recovery_codes WHERE user_id = $1", [user.userId]);
  await audit("totp.disabled", { actorUserId: user.userId });
  return { ok: true };
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const row = await queryOne<{ user_id: string }>("DELETE FROM sessions WHERE token_hash = $1 RETURNING user_id", [sha256(token)]);
    if (row) await audit("logout", { actorUserId: row.user_id });
  }
  store.delete(COOKIE);
}

/* ------------------------------- current user ------------------------------- */

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<{
    session_id: string;
    user_id: string;
    role: UserRole;
    ref_id: string;
    email: string;
    must_change_password: boolean;
    totp_enabled: boolean;
    disabled: boolean;
    last_seen_at: Date;
  }>(
    `SELECT s.id AS session_id, u.id AS user_id, u.role, u.ref_id, u.email, u.must_change_password, u.totp_enabled, u.disabled, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND s.last_seen_at > now() - $2 * interval '1 millisecond'`,
    [sha256(token), IDLE_MS],
  );
  if (!row || row.disabled) return null;

  if (Date.now() - new Date(row.last_seen_at).getTime() > TOUCH_EVERY_MS) {
    await query("UPDATE sessions SET last_seen_at = now() WHERE id = $1", [row.session_id]);
  }
  return {
    userId: row.user_id,
    sessionId: row.session_id,
    role: row.role,
    refId: row.ref_id,
    email: row.email,
    mustChangePassword: row.must_change_password,
    totpEnabled: row.totp_enabled,
  };
}

/* --------------------------- password management --------------------------- */

export async function changePassword(
  user: AuthUser,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const row = await queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [user.userId]);
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
    await audit("password.change_failed", { actorUserId: user.userId });
    return { ok: false, status: 403, error: "Your current password is incorrect." };
  }
  const problem = checkPasswordPolicy(newPassword, { email: user.email });
  if (problem) return { ok: false, status: 422, error: problem };
  if (await verifyPassword(newPassword, row.password_hash)) {
    return { ok: false, status: 422, error: "Choose a password you haven't used here before." };
  }

  const hash = await hashPassword(newPassword);
  await transaction(async (tx) => {
    await query("UPDATE users SET password_hash = $1, must_change_password = false, password_changed_at = now() WHERE id = $2", [hash, user.userId], tx);
    // Sign out everywhere else; keep this device signed in.
    await query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [user.userId, user.sessionId], tx);
  });
  await audit("password.changed", { actorUserId: user.userId });
  return { ok: true };
}

const RESET_TTL_MIN = 60;

/** Always resolves the same way, so it can't be used to discover which emails have accounts. */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  const { ip } = await getRequestInfo();
  if ((await recentFailures(`reset-ip:${ip}`)) >= 10) return;
  await query("INSERT INTO login_attempts (key) VALUES ($1)", [`reset-ip:${ip}`]);

  const user = await queryOne<UserRow>("SELECT * FROM users WHERE lower(email) = $1 AND NOT disabled", [email]);
  if (!user) return;
  const token = newToken();
  await transaction(async (tx) => {
    await query("DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL", [user.id], tx);
    await query(
      "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + $3 * interval '1 minute')",
      [user.id, sha256(token), RESET_TTL_MIN],
      tx,
    );
  });
  await audit("password.reset_requested", { actorUserId: user.id });
  await mailPasswordReset(user.email, `${env.appUrl}/reset-password?token=${token}`, RESET_TTL_MIN);
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const invalid = { ok: false as const, status: 400, error: "This reset link is invalid or has expired." };
  const row = await queryOne<{ id: string; user_id: string; email: string }>(
    `SELECT r.id, r.user_id, u.email FROM password_resets r JOIN users u ON u.id = r.user_id
      WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > now() AND NOT u.disabled`,
    [sha256(token)],
  );
  if (!row) return invalid;
  const problem = checkPasswordPolicy(newPassword, { email: row.email });
  if (problem) return { ok: false, status: 422, error: problem };

  const hash = await hashPassword(newPassword);
  const consumed = await transaction(async (tx) => {
    // The conditional update makes the token single-use even under concurrent requests.
    const used = await query("UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id", [row.id], tx);
    if (used.length === 0) return false;
    await query("UPDATE users SET password_hash = $1, must_change_password = false, password_changed_at = now() WHERE id = $2", [hash, row.user_id], tx);
    await query("DELETE FROM sessions WHERE user_id = $1", [row.user_id], tx);
    return true;
  });
  if (!consumed) return invalid;
  await audit("password.reset_completed", { actorUserId: row.user_id });
  return { ok: true };
}

/* ---------------------------------- sessions --------------------------------- */

export async function listSessions(user: AuthUser) {
  return query<{ id: string; created_at: Date; last_seen_at: Date; ip: string | null; user_agent: string | null }>(
    "SELECT id, created_at, last_seen_at, ip, user_agent FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY last_seen_at DESC",
    [user.userId],
  );
}

export async function revokeSession(user: AuthUser, sessionId: string): Promise<boolean> {
  const rows = await query("DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id", [sessionId, user.userId]);
  if (rows.length) await audit("session.revoked", { actorUserId: user.userId, target: sessionId });
  return rows.length > 0;
}
