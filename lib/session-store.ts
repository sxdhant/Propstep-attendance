import { api, setApiHooks } from "@/lib/api";
import { dataStore } from "@/lib/data-store";
import type { Session, UserRole } from "@/types/common";

/**
 * The signed-in user, as reported by the server (`/api/auth/me`). The real
 * session is an httpOnly cookie that JavaScript can't read; this store only
 * mirrors who it belongs to so the UI can route and label things.
 *
 * `undefined` = still asking the server, `null` = signed out.
 */

type Listener = () => void;
interface Me {
  role: UserRole;
  refId: string;
  email: string;
  mustChangePassword: boolean;
  totpEnabled?: boolean;
}

let session: Session | null | undefined;
let loading = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function toSession(me: Me): Session {
  return {
    role: me.role,
    email: me.email,
    employeeId: me.role === "employee" ? me.refId : "",
    adminId: me.role === "admin" ? me.refId : "",
    mustChangePassword: me.mustChangePassword,
    totpEnabled: me.totpEnabled ?? false,
  };
}

async function load() {
  if (loading) return;
  loading = true;
  const result = await api<Me>("GET", "/api/auth/me");
  loading = false;
  session = result.ok ? toSession(result.data) : null;
  notify();
}

setApiHooks({
  onUnauthorized: () => sessionStore.clear(),
  onPasswordChangeRequired: () => {
    if (session) sessionStore.update({ mustChangePassword: true });
  },
});

export const sessionStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    if (typeof window !== "undefined" && session === undefined) void load();
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot: (): Session | null | undefined => session,
  getServerSnapshot: (): Session | null | undefined => undefined,

  signIn(me: Me) {
    dataStore.clear();
    session = toSession(me);
    notify();
  },

  update(patch: Partial<Session>) {
    if (!session) return;
    session = { ...session, ...patch };
    notify();
  },

  /** Local sign-out of the UI state; the caller also tells the server. */
  clear() {
    session = null;
    dataStore.clear();
    notify();
  },

  reload() {
    session = undefined;
    notify();
    void load();
  },
};
