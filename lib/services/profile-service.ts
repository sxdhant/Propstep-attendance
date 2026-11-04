import { call } from "@/lib/services/core";
import type { ServiceResult } from "@/types/common";
import type { Employee } from "@/types/employee";
import type { ProfileContent } from "@/types/profile";

/**
 * Saves what the employee has filled in so far without checking it, so they
 * can leave and come back. A submitted profile is never downgraded to a draft.
 */
export function saveProfileDraft(_employeeId: string, content: ProfileContent): Promise<ServiceResult<Employee>> {
  return call("PUT", "/api/profile", { content });
}

/** The server checks every section, stores the profile as submitted and tells the admins. */
export function submitProfile(_employeeId: string, content: ProfileContent): Promise<ServiceResult<Employee>> {
  return call("POST", "/api/profile", { content });
}

/** Lets an admin nudge someone who has not finished their profile. */
export function sendProfileReminder(employeeId: string): Promise<ServiceResult<null>> {
  return call<null>("POST", `/api/employees/${encodeURIComponent(employeeId)}/profile-reminder`);
}
