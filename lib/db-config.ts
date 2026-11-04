/**
 * Turns DATABASE_URL (+ DATABASE_SSL) into node-postgres options. Shared by the
 * app and the CLI scripts, so there is exactly one place that decides how TLS works.
 *
 * DATABASE_SSL
 *   (unset) / false  no TLS. Fine for localhost only.
 *   true / require   encrypted, server certificate verified. Use for Neon and most hosts.
 *   no-verify        encrypted but the certificate is not verified. Supabase's database
 *                    certificates chain to a private CA, so use this, or better, set
 *                    DATABASE_SSL_CA to the CA certificate (PEM text) and keep `true`.
 *
 * Any `sslmode=` / `channel_binding=` in the URL is removed so these variables are the single source of truth
 * (newer versions of node-postgres otherwise let the URL override them).
 */

export interface PgOptions {
  connectionString: string;
  ssl?: { rejectUnauthorized: boolean; ca?: string };
}

export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function pgOptions(
  url: string,
  mode: string | undefined = process.env.DATABASE_SSL,
  ca: string | undefined = process.env.DATABASE_SSL_CA,
): PgOptions {
  const cleaned = new URL(url);
  cleaned.searchParams.delete("sslmode");
  cleaned.searchParams.delete("uselibpqcompat");
  cleaned.searchParams.delete("channel_binding");
  const connectionString = cleaned.toString();

  const normalized = (mode ?? "").trim().toLowerCase();
  if (normalized === "no-verify") return { connectionString, ssl: { rejectUnauthorized: false } };
  if (normalized === "true" || normalized === "require" || normalized === "verify-full") {
    return { connectionString, ssl: { rejectUnauthorized: true, ...(ca ? { ca: ca.replace(/\\n/g, "\n") } : {}) } };
  }
  return { connectionString };
}

/** URL for migrations / seeding: prefer a direct (non-pooled) connection when one is provided. */
export const adminDatabaseUrl = () =>
  process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/attendance";
