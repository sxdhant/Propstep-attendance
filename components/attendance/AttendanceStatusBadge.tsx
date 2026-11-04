import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ResolvedAttendance } from "@/lib/attendance-utils";
import {
  ACTIVITY_META,
  APPROVAL_STATUS_META,
  ATTENDANCE_STATUS_META,
  DAY_DISPLAY_META,
  type ActivityState,
} from "@/lib/status-config";
import type { ApprovalStatus, AttendanceStatus, DayDisplayStatus } from "@/types/attendance";

export function AttendanceStatusBadge({ status, className }: { status: AttendanceStatus; className?: string }) {
  return <StatusBadge meta={ATTENDANCE_STATUS_META[status]} className={className} />;
}

/** Approval states, or a quiet dash when the day needs no approval. */
export function ApprovalStatusBadge({
  status,
  className,
}: {
  status: ApprovalStatus;
  className?: string;
}) {
  if (status === "not_required") {
    return (
      <span className="text-muted-foreground" aria-label="No approval needed">
        —
      </span>
    );
  }
  return <StatusBadge meta={APPROVAL_STATUS_META[status]} className={className} />;
}

export function DayStatusBadge({ status, className }: { status: DayDisplayStatus; className?: string }) {
  return <StatusBadge meta={DAY_DISPLAY_META[status]} className={className} />;
}

export function getActivityState(record: ResolvedAttendance): ActivityState {
  if (record.checkOut) return "checked_out";
  return record.isToday ? "checked_in" : "no_checkout";
}

export function ActivityStateBadge({ record, className }: { record: ResolvedAttendance; className?: string }) {
  return <StatusBadge meta={ACTIVITY_META[getActivityState(record)]} className={className} />;
}
