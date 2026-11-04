/** Calendar date in the company timezone, formatted `YYYY-MM-DD`. */
export type DateKey = string;

/** ISO-8601 timestamp that carries its UTC offset, e.g. `2026-10-30T09:42:00+05:30`. */
export type IsoTimestamp = string;

export type UserRole = "admin" | "employee";

/** Who is signed in, as reported by the server. The real credential is an httpOnly cookie. */
export interface Session {
  /** Which dashboard experience is currently active. */
  role: UserRole;
  /** Employee persona used by the employee dashboard. */
  employeeId: string;
  /** Admin persona used by the admin dashboard. */
  adminId: string;
  email?: string;
  /** The account still has a temporary password and must choose a new one. */
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
}

/**
 * Every mutation in the service layer resolves to this shape, so the UI is
 * already written against the success/failure contract a real API will have.
 */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface MonthRef {
  year: number;
  /** 1-12 */
  month: number;
}
