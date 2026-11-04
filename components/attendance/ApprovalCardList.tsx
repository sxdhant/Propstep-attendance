"use client";

import { Lock } from "lucide-react";
import { ApprovalStatusBadge, AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { LateChip, needsAttendanceChip } from "@/components/attendance/ApprovalTable";
import { getReviewBlocks, ReviewActions } from "@/components/attendance/ReviewActions";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import type { ApprovalRow } from "@/lib/selectors/admin";

interface ApprovalCardListProps {
  rows: ApprovalRow[];
  onView: (row: ApprovalRow) => void;
  onApprove: (row: ApprovalRow) => void;
  onReject: (row: ApprovalRow) => void;
}

/** The approvals table, reshaped for phones: one card per request with the decision buttons within thumb reach. */
export function ApprovalCardList({ rows, onView, onApprove, onReject }: ApprovalCardListProps) {
  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const { employee, record, locked } = row;
        const { awaitingCheckout } = getReviewBlocks(row);
        return (
          <li key={record.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar name={employee.fullName} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {employee.id}, {formatDate(record.date)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <ApprovalStatusBadge status={record.approval} />
                {needsAttendanceChip(row) && <AttendanceStatusBadge status={record.effectiveStatus} />}
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Check-in</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-medium text-foreground">
                  {formatTime(record.checkIn)}
                  {record.isLate && <LateChip minutes={record.lateMinutes} />}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Check-out</dt>
                <dd className="mt-0.5 font-medium text-foreground">{formatTime(record.checkOut)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {awaitingCheckout ? "Working" : formatDuration(record.workedMinutes)}
                </dd>
              </div>
            </dl>

            {locked && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Payroll for this month is finalized.
              </p>
            )}

            <ReviewActions row={row} onView={onView} onApprove={onApprove} onReject={onReject} fill />
          </li>
        );
      })}
    </ul>
  );
}
