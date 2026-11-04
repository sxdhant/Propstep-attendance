import { z } from "zod";
import { parseClockTime } from "@/lib/date-utils";
import type { Employee } from "@/types/employee";

/**
 * Frontend validation only. Every rule here is also a rule the backend must
 * enforce on its own; the server never trusts the browser.
 */

const requiredEmail = (requiredMessage: string) =>
  z.string().trim().min(1, requiredMessage).pipe(z.email("Enter a valid email address, like name@company.com."));

/* ---------------------------------- login ---------------------------------- */

export const loginSchema = z.object({
  email: requiredEmail("Enter your work email."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean(),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: requiredEmail("Enter the email you sign in with."),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/* -------------------------------- employees --------------------------------- */

export function createEmployeeSchema(existing: Employee[], editingId?: string) {
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, "Enter the employee's full name.")
        .max(80, "Keep the name under 80 characters."),
      /** Assigned by the server when the employee is created. */
      id: z.string().optional(),
      email: requiredEmail("Enter an email address."),
      phone: z
        .string()
        .trim()
        .min(1, "Enter a phone number.")
        .regex(/^\+?[0-9][0-9\s-]{8,16}$/, "Enter a valid phone number, like +91 98765 43210."),
      department: z.string().min(1, "Choose a department."),
      designation: z
        .string()
        .trim()
        .min(2, "Enter a designation.")
        .max(60, "Keep the designation under 60 characters."),
      joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a joining date."),
      monthlyBasicSalary: z
        .number({ error: "Enter the monthly basic salary." })
        .min(1000, "Monthly basic salary must be at least 1,000.")
        .max(10_000_000, "Monthly basic salary looks too high. Check the amount."),
      status: z.enum(["active", "inactive"]),
    })
    .superRefine((values, ctx) => {
      const emailTaken = existing.some(
        (e) => e.id !== editingId && e.email.toLowerCase() === values.email.toLowerCase(),
      );
      if (emailTaken) {
        ctx.addIssue({ code: "custom", path: ["email"], message: "This email belongs to another employee." });
      }
    });
}
export type EmployeeFormValues = z.infer<ReturnType<typeof createEmployeeSchema>>;

/* ------------------------------ admin profile ------------------------------- */

export const adminProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80, "Keep the name under 80 characters."),
  title: z.string().trim().min(2, "Enter your job title.").max(60, "Keep the title under 60 characters."),
  phone: z
    .string()
    .trim()
    .max(20, "Keep the phone number under 20 characters.")
    .refine((value) => value === "" || /^\+?[0-9][0-9\s-]{8,16}$/.test(value), "Enter a valid phone number, like +91 98765 43210."),
});
export type AdminProfileValues = z.infer<typeof adminProfileSchema>;

/* ------------------------------- attendance --------------------------------- */

export const rejectionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters so the employee knows what to fix.")
    .max(300, "Keep the reason under 300 characters."),
});
export type RejectionValues = z.infer<typeof rejectionSchema>;

/* --------------------------------- payroll ---------------------------------- */

export const paymentSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(4, "Enter the payment reference, at least 4 characters.")
    .max(40, "Keep the reference under 40 characters.")
    .regex(/^[A-Za-z0-9/_-]+$/, "Use letters, numbers, hyphens, underscores or slashes only."),
});
export type PaymentValues = z.infer<typeof paymentSchema>;

/* --------------------------------- settings --------------------------------- */

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format, like 09:30.");

export const companySettingsSchema = z.object({
  name: z.string().trim().min(2, "Enter the company name.").max(80, "Keep the name under 80 characters."),
  timezone: z.string().min(1, "Choose a timezone."),
  currency: z.string().min(1, "Choose a currency."),
});
export type CompanySettingsValues = z.infer<typeof companySettingsSchema>;

export const attendancePolicySchema = z
  .object({
    officeStartTime: timeOfDay,
    officeEndTime: timeOfDay,
    requiredWorkingHours: z
      .number({ error: "Enter the required working hours." })
      .min(1, "Must be at least 1 hour.")
      .max(16, "Must be 16 hours or less."),
    lateGraceMinutes: z
      .number({ error: "Enter the grace period in minutes." })
      .int("Use whole minutes.")
      .min(0, "Cannot be negative.")
      .max(120, "Must be 120 minutes or less."),
    halfDayThresholdHours: z
      .number({ error: "Enter the half-day threshold." })
      .min(0.5, "Must be at least 0.5 hours.")
      .max(12, "Must be 12 hours or less."),
    weeklyOffs: z.array(z.number().int().min(0).max(6)).max(6, "Keep at least one working day in the week."),
  })
  .superRefine((values, ctx) => {
    if (parseClockTime(values.officeEndTime) <= parseClockTime(values.officeStartTime)) {
      ctx.addIssue({ code: "custom", path: ["officeEndTime"], message: "Closing time must be after the start time." });
    }
    if (values.halfDayThresholdHours >= values.requiredWorkingHours) {
      ctx.addIssue({
        code: "custom",
        path: ["halfDayThresholdHours"],
        message: "Must be less than the required working hours.",
      });
    }
  });
export type AttendancePolicyValues = z.infer<typeof attendancePolicySchema>;

export const salaryPolicySchema = z.object({
  divisorPolicy: z.enum(["scheduled_working_days", "calendar_days", "fixed"]),
  fixedDivisor: z
    .number({ error: "Enter the fixed divisor." })
    .int("Use a whole number.")
    .min(1, "Must be at least 1.")
    .max(31, "Must be 31 or less."),
  halfDayUnits: z.number(),
  payDay: z
    .number({ error: "Enter the payment day." })
    .int("Use a whole number.")
    .min(1, "Must be between 1 and 28.")
    .max(28, "Must be between 1 and 28."),
});
export type SalaryPolicyValues = z.infer<typeof salaryPolicySchema>;
