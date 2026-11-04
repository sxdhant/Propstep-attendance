import { StatusBadge } from "@/components/shared/StatusBadge";
import { getProfileStatus } from "@/lib/profile-utils";
import { PROFILE_STATUS_META } from "@/lib/status-config";
import type { Employee } from "@/types/employee";

export function ProfileStatusBadge({ employee, className }: { employee: Employee; className?: string }) {
  return <StatusBadge meta={PROFILE_STATUS_META[getProfileStatus(employee)]} className={className} />;
}
