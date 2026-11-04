import "server-only";

/**
 * Validated server configuration. Values are read when first used (not at
 * import), so `next build` works without secrets, while a running production
 * server still fails fast on the first request if one is missing.
 */

import { isLocalUrl } from "@/lib/db-config";

const isProd = process.env.NODE_ENV === "production";

function required(name: string, devFallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (!isProd && devFallback) return devFallback;
  throw new Error(`Missing required environment variable ${name}.`);
}

export const env = {
  isProd,
  get databaseUrl() {
    return required("DATABASE_URL", "postgres://postgres:postgres@localhost:54329/attendance");
  },
  /**
   * TLS mode, see lib/db-config.ts. A production database that isn't on localhost
   * must say how to secure the connection; silently using plaintext is refused.
   */
  get databaseSsl() {
    const mode = process.env.DATABASE_SSL;
    if (isProd && !mode && !isLocalUrl(this.databaseUrl)) {
      throw new Error("Set DATABASE_SSL=true (or no-verify) for a remote production database.");
    }
    return mode;
  },
  get databasePoolMax() {
    const n = Number(process.env.DATABASE_POOL_MAX);
    return Number.isInteger(n) && n > 0 ? n : 10;
  },
  /** Public origin of the site, used in email links and the CSRF origin check. */
  get appUrl() {
    return required("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  /** Only trust X-Forwarded-For when running behind a proxy you control. */
  get trustProxy() {
    return process.env.TRUST_PROXY === "true";
  },
  /** Encrypts TOTP seeds at rest. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" */
  get encryptionKey() {
    const key = required("APP_ENCRYPTION_KEY", "dev-only-encryption-key-do-not-use-in-production");
    if (isProd && key.length < 32) throw new Error("APP_ENCRYPTION_KEY must be at least 32 characters in production.");
    return key;
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY;
  },
  get mailFrom() {
    return process.env.MAIL_FROM ?? "Propstep <no-reply@localhost>";
  },
};
