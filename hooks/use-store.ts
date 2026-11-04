"use client";

import { useCallback, useSyncExternalStore } from "react";
import { dataStore } from "@/lib/data-store";
import { sessionStore } from "@/lib/session-store";
import type { Session } from "@/types/common";
import type { Database } from "@/types/database";

/**
 * Hydration-safe access to the browser-only stores.
 *
 * Both hooks return a "not ready" value (`null` / `undefined`) on the server
 * and during hydration, then the real value immediately after, so server and
 * client markup always match.
 */

export function useDb(): Database | null {
  return useSyncExternalStore(dataStore.subscribe, dataStore.getSnapshot, dataStore.getServerSnapshot);
}

/** The reason the first data load failed, or `null`. */
export function useDataError(): string | null {
  return useSyncExternalStore(dataStore.subscribe, dataStore.getError, dataStore.getServerError);
}

/** `undefined` while loading, `null` when signed out. */
export function useSessionState(): Session | null | undefined {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getServerSnapshot);
}

const getServerTick = () => null;

/**
 * Re-renders the caller every `intervalMs` and returns the real clock
 * (epoch ms) rounded down to that interval. `null` until the client is ready.
 */
export function useTicker(intervalMs: number): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs],
  );
  const getSnapshot = useCallback(() => Math.floor(Date.now() / intervalMs) * intervalMs, [intervalMs]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerTick);
}
