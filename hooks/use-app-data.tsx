"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useDb, useSessionState, useTicker } from "@/hooks/use-store";
import type { AttendanceContext } from "@/lib/attendance-utils";
import { createAttendanceContext } from "@/lib/selectors/context";
import type { DateKey, Session, UserRole } from "@/types/common";
import type { Database } from "@/types/database";
import type { AdminUser, Employee } from "@/types/employee";

/** How often the shared "now" refreshes. Components needing seconds use their own ticker. */
const SHARED_TICK_MS = 30_000;

export interface AppUser {
  name: string;
  email: string;
  subtitle: string;
}

export interface AppData {
  db: Database;
  /** Current time in epoch ms, refreshed every 30 seconds. */
  nowMs: number;
  today: DateKey;
  ctx: AttendanceContext;
  session: Session;
  /** Which dashboard is on screen. It follows the URL, not the session. */
  role: UserRole;
  /** The employee persona (used by the employee dashboard). */
  employee: Employee;
  /** The administrator persona (used by the admin dashboard). */
  admin: AdminUser;
  /** Whoever is being previewed right now. */
  user: AppUser;
  /** Notification recipient id for the active dashboard. */
  recipientId: string;
}

/** Stand-in "employee persona" for an admin in a company with no employees. Never shown to a user. */
const NO_EMPLOYEE: Employee = {
  id: "",
  fullName: "",
  email: "",
  phone: "",
  department: "",
  designation: "",
  joiningDate: "2000-01-01",
  monthlyBasicSalary: 0,
  status: "inactive",
};

const AppDataContext = createContext<AppData | null>(null);

interface AppDataProviderProps {
  role: UserRole;
  children: ReactNode;
  fallback: ReactNode;
}

/**
 * Supplies the loaded data, the signed-in user and a shared clock to every
 * dashboard page. Children only render once all three exist, so pages can
 * rely on `useAppData()` never being empty.
 *
 * The dashboard shown is chosen by the route (`role` prop). Access control
 * lives on the server; the layout only redirects people to their own dashboard.
 */
export function AppDataProvider({ role, children, fallback }: AppDataProviderProps) {
  const db = useDb();
  const session = useSessionState();
  const tick = useTicker(SHARED_TICK_MS);

  const value = useMemo<AppData | null>(() => {
    if (!db || !session || tick === null) return null;
    const found = db.employees.find((e) => e.id === session.employeeId) ?? db.employees[0];
    const admin = db.admins.find((a) => a.id === session.adminId) ?? db.admins[0];
    if (!admin) return null;
    // An employee dashboard needs the employee's own record. An admin dashboard does not, and a
    // new company has no employees yet, so the admin gets an empty placeholder instead of waiting forever.
    if (!found && role === "employee") return null;
    const employee = found ?? NO_EMPLOYEE;

    const nowMs = tick + db.clockOffsetMs;
    const ctx = createAttendanceContext(db, nowMs);
    const user: AppUser =
      role === "admin"
        ? { name: admin.fullName, email: admin.email, subtitle: admin.title }
        : { name: employee.fullName, email: employee.email, subtitle: employee.designation };

    return {
      db,
      nowMs,
      today: ctx.today,
      ctx,
      session,
      role,
      employee,
      admin,
      user,
      recipientId: role === "admin" ? "admin" : employee.id,
    };
  }, [db, session, tick, role]);

  if (!value) return <>{fallback}</>;
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside the dashboard layout.");
  return value;
}
