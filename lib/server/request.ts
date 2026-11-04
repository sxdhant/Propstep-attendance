import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/server/env";

export interface RequestInfo {
  ip: string;
  userAgent: string;
}

export async function getRequestInfo(): Promise<RequestInfo> {
  const h = await headers();
  // X-Forwarded-For is attacker-controlled unless a trusted proxy overwrites it.
  const forwarded = env.trustProxy ? h.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
  return {
    ip: forwarded || h.get("x-real-ip") || "unknown",
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

/**
 * CSRF defence for state-changing requests, on top of SameSite=Lax cookies:
 * the browser must say the request came from our own origin.
 */
export async function isSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin === env.appUrl || origin === `${new URL(env.appUrl).protocol}//${h.get("host")}`;
  const site = h.get("sec-fetch-site");
  // Non-browser clients (curl, server-to-server) send neither header and carry no ambient cookies.
  if (!site) return !h.get("cookie");
  return site === "same-origin" || site === "none";
}
