import { z } from "zod";
import { addDays, parseDateKey } from "@/lib/date-utils";
import { BLOOD_GROUPS, GENDERS, MARITAL_STATUSES, RELATIONSHIPS } from "@/lib/profile-options";
import type { DateKey } from "@/types/common";

/**
 * Frontend validation for the employee profile. The backend must enforce the
 * same rules itself. Each section is its own schema so the form can check one
 * step at a time and the admin list can tell which sections are finished.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const values = <T extends readonly { value: string }[]>(options: T) => options.map((o) => o.value) as [string, ...string[]];

function addressSchema(label: string) {
  return z.object({
    line1: z.string().trim().min(5, `Enter the ${label} street address.`).max(120, "Keep the address under 120 characters."),
    city: z.string().trim().min(2, "Enter the city.").max(60, "Keep the city under 60 characters."),
    state: z.string().min(1, "Choose a state."),
    pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a 6-digit PIN code."),
  });
}

const looseAddress = z.object({ line1: z.string(), city: z.string(), state: z.string(), pincode: z.string() });

export function createProfileSchemas(today: DateKey) {
  const year = parseDateKey(today).year;
  const eighteenYearsAgo = addDays(today, -365 * 18);

  const personal = z
    .object({
      dateOfBirth: z
        .string()
        .regex(DATE, "Choose your date of birth.")
        .refine((d) => d >= "1950-01-01", "Check the year. The date is too far back.")
        .refine((d) => d <= eighteenYearsAgo, "You must be at least 18 years old."),
      gender: z.enum(values(GENDERS), { error: "Choose an option." }),
      maritalStatus: z.enum(values(MARITAL_STATUSES), { error: "Choose an option." }),
      bloodGroup: z.union([z.literal(""), z.enum(BLOOD_GROUPS)]),
      personalEmail: z.union([z.literal(""), z.email("Enter a valid email address, like name@example.com.")]),
      currentAddress: addressSchema("current"),
      permanentSameAsCurrent: z.boolean(),
      permanentAddress: looseAddress,
    })
    .superRefine((v, ctx) => {
      if (v.permanentSameAsCurrent) return;
      const parsed = addressSchema("permanent").safeParse(v.permanentAddress);
      if (parsed.success) return;
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: "custom", path: ["permanentAddress", ...issue.path], message: issue.message });
      }
    });

  const education = z
    .array(
      z.object({
        id: z.string(),
        degree: z.string().min(1, "Choose a qualification."),
        fieldOfStudy: z.string().trim().min(2, "Enter the course or specialisation.").max(80, "Keep it under 80 characters."),
        institution: z.string().trim().min(2, "Enter the school, college or university.").max(100, "Keep it under 100 characters."),
        yearOfPassing: z
          .string()
          .regex(/^\d{4}$/, "Enter a 4-digit year.")
          .refine((y) => Number(y) >= 1960 && Number(y) <= year + 5, "Check the year."),
      }),
    )
    .min(1, "Add at least one qualification.")
    .max(8, "You can add up to 8 qualifications.");

  const experience = z
    .object({
      isFresher: z.boolean(),
      entries: z.array(
        z.object({
          id: z.string(),
          company: z.string().trim().min(2, "Enter the company name.").max(80, "Keep it under 80 characters."),
          designation: z.string().trim().min(2, "Enter your role.").max(80, "Keep it under 80 characters."),
          from: z.string().regex(DATE, "Choose the start date."),
          to: z.string(),
          current: z.boolean(),
          responsibilities: z.string().trim().max(400, "Keep this under 400 characters."),
        }),
      ),
      skills: z.array(z.string().trim().min(1).max(40)).min(1, "Add at least one skill.").max(20, "Keep it to 20 skills."),
      summary: z.string().trim().max(500, "Keep the summary under 500 characters."),
    })
    .superRefine((v, ctx) => {
      if (!v.isFresher && v.entries.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["entries"],
          message: "Add your previous employers, or choose “I'm a fresher”.",
        });
      }
      v.entries.forEach((entry, i) => {
        if (!entry.current && !DATE.test(entry.to)) {
          ctx.addIssue({ code: "custom", path: ["entries", i, "to"], message: "Choose the end date, or tick “I currently work here”." });
        }
        if (!entry.current && DATE.test(entry.to) && DATE.test(entry.from) && entry.to < entry.from) {
          ctx.addIssue({ code: "custom", path: ["entries", i, "to"], message: "The end date can't be before the start date." });
        }
        if (DATE.test(entry.from) && entry.from > today) {
          ctx.addIssue({ code: "custom", path: ["entries", i, "from"], message: "The start date can't be in the future." });
        }
      });
    });

  const emergency = z.object({
    name: z.string().trim().min(2, "Enter the contact's name.").max(80, "Keep the name under 80 characters."),
    relationship: z.enum(values(RELATIONSHIPS), { error: "Choose how they are related to you." }),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{8,16}$/, "Enter a valid phone number, like +91 98765 43210."),
  });

  const bank = z.object({
    accountHolder: z.string().trim().min(2, "Enter the name on the account.").max(80, "Keep the name under 80 characters."),
    bankName: z.string().trim().min(2, "Enter the bank name.").max(60, "Keep the name under 60 characters."),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Enter 9 to 18 digits, with no spaces."),
    ifsc: z.string().trim().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, "Enter an 11-character IFSC, like HDFC0001234."),
    pan: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, "Enter a valid PAN, like ABCDE1234F.")]),
    uan: z.union([z.literal(""), z.string().trim().regex(/^\d{12}$/, "A UAN has 12 digits.")]),
  });

  return { personal, education, experience, emergency, bank, full: z.object({ personal, education, experience, emergency, bank }) };
}

export type ProfileSchemas = ReturnType<typeof createProfileSchemas>;
