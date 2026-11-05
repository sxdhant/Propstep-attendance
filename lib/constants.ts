import type { UserRole } from "@/types/common";
import type { AppSettings } from "@/types/settings";

export const APP_NAME = "Propstep";

/** The demo runs entirely in Indian Standard Time. India has no DST, so the offset is constant. */
export const TIMEZONE = "Asia/Kolkata";
export const TZ_OFFSET = "+05:30";

/** Bump when the shape of the persisted mock database changes; older data is re-seeded. */
// Bumped when the stored shape changes (2: employee profiles). Older saved demo data is replaced by a fresh seed.
export const DB_VERSION = 4;

export const STORAGE_KEYS = {
  rememberedEmail: "attendance-payroll:remembered-email",
} as const;

export const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Sales",
  "Marketing",
  "Human Resources",
  "Finance",
  "Operations",
  "Customer Support",
] as const;

export const WEEKDAYS = [
  { value: 0, short: "Sun", long: "Sunday" },
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
] as const;

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)", locale: "en-IN" },
  { code: "USD", label: "US Dollar ($)", locale: "en-US" },
  { code: "EUR", label: "Euro (€)", locale: "en-IE" },
  { code: "GBP", label: "Pound Sterling (£)", locale: "en-GB" },
  { code: "AED", label: "UAE Dirham (AED)", locale: "en-AE" },
] as const;

export const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India Standard Time (Asia/Kolkata)" },
] as const;

/**
 * Credentials accepted by the demo login form. This is a convenience for the
 * frontend phase only: nothing is verified or stored server-side.
 */
export const DEMO_ACCOUNTS = {
  employee: {
    email: "aarav.sharma@kestrel.example",
    password: "Employee@123",
    employeeId: "EMP-1001",
  },
  admin: {
    email: "neha.kapoor@kestrel.example",
    password: "Admin@123",
    adminId: "ADM-001",
  },
} as const;

export const HOME_BY_ROLE: Record<UserRole, string> = {
  employee: "/employee/dashboard",
  admin: "/admin/dashboard",
};

export const DEFAULT_SETTINGS: AppSettings = {
  company: {
    name: "Propstep",
    timezone: TIMEZONE,
    currency: "INR",
  },
  attendance: {
    officeStartTime: "10:00",
    officeEndTime: "18:30",
    requiredWorkingHours: 8,
    lateGraceMinutes: 15,
    halfDayThresholdHours: 4,
    // Every day is a working day; the admin marks days off as holidays.
    weeklyOffs: [],
  },
  salary: {
    divisorPolicy: "scheduled_working_days",
    fixedDivisor: 26,
    halfDayUnits: 0.5,
    payDay: 5,
  },
};

export const HALF_DAY_RULES = [
  { value: 0.5, label: "Half day counts as 0.5 payable day (standard)" },
  { value: 0.25, label: "Half day counts as 0.25 payable day" },
  { value: 0, label: "Half day is unpaid" },
] as const;
