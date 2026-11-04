import { describe, expect, it } from "vitest";
import { isLocalUrl, pgOptions } from "@/lib/db-config";

const NEON = "postgresql://user:pw@ep-cool-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
const SUPABASE = "postgresql://postgres.abcd:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

describe("database connection options", () => {
  it("uses no TLS by default (localhost development)", () => {
    expect(pgOptions("postgres://u:p@localhost:5432/db", "", "").ssl).toBeUndefined();
  });

  it("verifies certificates for true / require, as Neon needs", () => {
    expect(pgOptions(NEON, "true", "").ssl).toEqual({ rejectUnauthorized: true });
    expect(pgOptions(NEON, "require", "").ssl).toEqual({ rejectUnauthorized: true });
  });

  it("allows an explicit CA, with escaped newlines from env files", () => {
    expect(pgOptions(SUPABASE, "true", "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----").ssl?.ca).toContain("\nabc\n");
  });

  it("supports encrypted-but-unverified for hosts with a private CA", () => {
    expect(pgOptions(SUPABASE, "no-verify", "").ssl).toEqual({ rejectUnauthorized: false });
  });

  it("strips sslmode from the URL so DATABASE_SSL is the single source of truth", () => {
    expect(pgOptions(NEON, "true").connectionString).not.toContain("sslmode");
    expect(pgOptions(NEON, "true").connectionString).toContain("ep-cool-123-pooler");
  });

  it("recognises local URLs", () => {
    expect(isLocalUrl("postgres://u:p@localhost:5432/db")).toBe(true);
    expect(isLocalUrl("postgres://u:p@127.0.0.1/db")).toBe(true);
    expect(isLocalUrl(NEON)).toBe(false);
  });
});
