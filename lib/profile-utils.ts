import { createProfileSchemas } from "@/lib/validation/profile-schemas";
import type { DateKey } from "@/types/common";
import type { Employee } from "@/types/employee";
import {
  PROFILE_SECTIONS,
  type Address,
  type EducationEntry,
  type EmployeeProfile,
  type ExperienceEntry,
  type ProfileContent,
  type ProfileSection,
  type ProfileStatus,
} from "@/types/profile";

export const emptyAddress = (): Address => ({ line1: "", city: "", state: "", pincode: "" });

let entrySequence = 0;
/** A client-side key for a list row. A database assigns real ids later. */
export function newEntryId(prefix: string): string {
  entrySequence += 1;
  return `${prefix}-${Date.now().toString(36)}${entrySequence.toString(36)}`;
}

export const emptyEducation = (): EducationEntry => ({
  id: newEntryId("edu"),
  degree: "",
  fieldOfStudy: "",
  institution: "",
  yearOfPassing: "",
});

export const emptyExperience = (): ExperienceEntry => ({
  id: newEntryId("exp"),
  company: "",
  designation: "",
  from: "",
  to: "",
  current: false,
  responsibilities: "",
});

export function emptyProfileContent(): ProfileContent {
  return {
    personal: {
      dateOfBirth: "",
      gender: "",
      maritalStatus: "",
      bloodGroup: "",
      personalEmail: "",
      currentAddress: emptyAddress(),
      permanentSameAsCurrent: true,
      permanentAddress: emptyAddress(),
    },
    education: [],
    experience: { isFresher: false, entries: [], skills: [], summary: "" },
    emergency: { name: "", relationship: "", phone: "" },
    bank: { accountHolder: "", bankName: "", accountNumber: "", ifsc: "", pan: "", uan: "" },
  };
}

/** The editable part of a saved profile, or an empty form when none exists. */
export function contentOf(profile: EmployeeProfile | undefined): ProfileContent {
  if (!profile) return emptyProfileContent();
  const { personal, education, experience, emergency, bank } = structuredClone(profile);
  return { personal, education, experience, emergency, bank };
}

export function getProfileStatus(employee: Employee): ProfileStatus {
  if (!employee.profile) return "not_started";
  return employee.profile.state === "submitted" ? "complete" : "in_progress";
}

/** Active employees must submit their profile before using the rest of the app. */
export function mustCompleteProfile(employee: Employee): boolean {
  return employee.status === "active" && getProfileStatus(employee) !== "complete";
}

/** Which sections already satisfy their rules. Used for the progress bar and the admin list. */
export function sectionCompletion(content: ProfileContent, today: DateKey): Record<ProfileSection, boolean> {
  const schemas = createProfileSchemas(today);
  return Object.fromEntries(
    PROFILE_SECTIONS.map((section) => [section, schemas[section].safeParse(content[section]).success]),
  ) as Record<ProfileSection, boolean>;
}

export function completedSectionCount(employee: Employee, today: DateKey): number {
  if (!employee.profile) return 0;
  return Object.values(sectionCompletion(contentOf(employee.profile), today)).filter(Boolean).length;
}

/** Shows only the last four digits, like a bank statement. */
export function maskAccountNumber(value: string): string {
  if (!value) return "";
  return `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export function maskPan(value: string): string {
  if (value.length < 10) return value;
  return `${value.slice(0, 2)}${"•".repeat(6)}${value.slice(-2)}`;
}

export function formatAddress(address: Address): string {
  return [address.line1, address.city, address.state, address.pincode].filter(Boolean).join(", ");
}

/** Whole months between two dates, used to total previous experience. */
export function experienceMonths(entries: ExperienceEntry[], today: DateKey): number {
  let months = 0;
  for (const entry of entries) {
    if (!entry.from) continue;
    const end = entry.current || !entry.to ? today : entry.to;
    const [fy, fm] = entry.from.split("-").map(Number);
    const [ey, em] = end.split("-").map(Number);
    months += Math.max(0, (ey - fy) * 12 + (em - fm));
  }
  return months;
}

export function formatExperience(months: number): string {
  if (months <= 0) return "Fresher";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years ? `${years} yr${years === 1 ? "" : "s"}` : "", rest ? `${rest} mo` : ""].filter(Boolean);
  return parts.join(" ");
}
