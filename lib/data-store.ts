import { api } from "@/lib/api";
import { setActiveCurrency } from "@/lib/format";
import type { Database } from "@/types/database";

/**
 * Client cache of the signed-in user's data, fetched from `/api/bootstrap`.
 * It is exposed as an external store so React reads it with `useSyncExternalStore`
 * and the existing selectors work unchanged.
 *
 *  - The server snapshot is always `null`, so SSR and hydration agree.
 *  - Services call `refresh()` after every successful change; the server is the
 *    source of truth and the cache is never edited locally.
 *  - It re-syncs every minute and when the tab becomes visible again.
 */

type Listener = () => void;

const POLL_MS = 60_000;

let state: Database | null = null;
let error: string | null = null;
let inFlight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let visibilityBound = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

async function load(): Promise<void> {
  const result = await api<{ db: Database }>("GET", "/api/bootstrap");
  if (result.ok) {
    state = result.data.db;
    error = null;
    setActiveCurrency(state.settings.company.currency);
  } else {
    // Keep showing the last good data; only a first load with nothing to show becomes an error.
    error = state ? null : result.error;
  }
  notify();
}

function refresh(): Promise<void> {
  inFlight ??= load().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function start() {
  if (!state && !inFlight) void refresh();
  if (!timer) timer = setInterval(() => document.visibilityState === "visible" && void refresh(), POLL_MS);
  if (!visibilityBound) {
    visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && listeners.size > 0) void refresh();
    });
  }
}

export const dataStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    if (typeof window !== "undefined") start();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  },
  getSnapshot: (): Database | null => state,
  getServerSnapshot: (): Database | null => null,
  getError: (): string | null => error,
  getServerError: (): string | null => null,
  refresh,
  /** Forgets everything (sign-out, or a different user signing in). */
  clear() {
    state = null;
    error = null;
    notify();
  },
};
