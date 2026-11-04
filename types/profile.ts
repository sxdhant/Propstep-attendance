import type { DateKey, IsoTimestamp } from "./common";

/**
 * Details an employee fills in about themselves after their account is
 * created. Text fields are plain strings so a half-finished draft can be saved;
 * the rules in `lib/validation/profile-schemas.ts` decide what counts as done.
 */

export interface Address {
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface PersonalDetails {
  dateOfBirth: DateKey | "";
  gender: string;
  maritalStatus: string;
  bloodGroup: string;
  personalEmail: string;
  currentAddress: Address;
  permanentSameAsCurrent: boolean;
  permanentAddress: Address;
}

export interface EducationEntry {
  id: string;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  yearOfPassing: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  designation: string;
  from: DateKey | "";
  /** Empty while `current` is true. */
  to: DateKey | "";
  current: boolean;
  responsibilities: string;
}

export interface ExperienceDetails {
  /** A fresher has no previous employers to list. */
  isFresher: boolean;
  entries: ExperienceEntry[];
  skills: string[];
  summary: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface BankDetails {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  pan: string;
  uan: string;
}

export type ProfileSaveState = "draft" | "submitted";

export interface EmployeeProfile {
  /** `draft` is saved but not yet sent; `submitted` unlocks the rest of the app. */
  state: ProfileSaveState;
  updatedAt: IsoTimestamp;
  submittedAt?: IsoTimestamp;
  personal: PersonalDetails;
  education: EducationEntry[];
  experience: ExperienceDetails;
  emergency: EmergencyContact;
  bank: BankDetails;
}

/** What the employee edits: everything except the bookkeeping fields. */
export type ProfileContent = Omit<EmployeeProfile, "state" | "updatedAt" | "submittedAt">;

/** Derived from the employee record; never stored. */
export type ProfileStatus = "not_started" | "in_progress" | "complete";

export const PROFILE_SECTIONS = ["personal", "education", "experience", "emergency", "bank"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];
