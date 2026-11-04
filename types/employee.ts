import type { DateKey } from "./common";
import type { EmployeeProfile } from "./profile";

export type AccountStatus = "active" | "inactive";

export interface Employee {
  /** Employee ID shown in the UI and used as the primary key, e.g. `EMP-1001`. */
  id: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joiningDate: DateKey;
  /** Monthly basic salary in the company currency (INR for the demo). */
  monthlyBasicSalary: number;
  status: AccountStatus;
  /** Set when the account is deactivated; attendance is not expected after this date. */
  deactivatedOn?: DateKey;
  /** Filled in by the employee after the account is created. Absent until they start. */
  profile?: EmployeeProfile;
  /** Versioned URL of the profile photo, when one has been uploaded. */
  photoUrl?: string;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  title: string;
  phone?: string;
  photoUrl?: string;
}

/** Fields an admin can submit when creating or editing an employee. */
export type EmployeeInput = Omit<Employee, "deactivatedOn" | "profile" | "photoUrl">;
