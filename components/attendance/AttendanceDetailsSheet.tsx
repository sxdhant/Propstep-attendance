"use client";

import { CalendarOff, CircleCheck, CircleX, Clock, LogIn, LogOut, PartyPopper, UserX } from "lucide-react";
import type { ReactNode } from "react";
import { ApprovalStatusBadge, AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { DetailList } from "@/components/shared/DetailList";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAppData } from "@/hooks/use-app-data";
import { describeIncomplete, type DayEntry } from "@/lib/attendance-utils";
import { formatDateTime, formatDuration, formatTime, formatWeekday, formatDate } from "@/lib/format";
import { ATTENDANCE_STATUS_META } from "@/lib/status-config";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types/employee";

interface AttendanceDetailsSheetProps {
  entry: DayEntry | null;
  /** Shown at the top when an administrator is looking at someone else's record. */
  employee?: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimelineEvent {
  icon: typeof LogIn;
  tone: string;
  title: string;
  detail?: ReactNode;
  at?: string;
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-5 border-l pl-6">
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <li key={index} className="relative">
            <span
              className={cn(
                "absolute top-0 -left-[2.0625rem] grid size-6 place-items-center rounded-full ring-4 ring-background",
                event.tone,
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">{event.title}</p>
            {event.at && <p className="text-xs text-muted-foreground">{event.at}</p>}
            {event.detail && <div className="mt-1 text-sm text-muted-foreground">{event.detail}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function NoRecordNote({ entry }: { entry: DayEntry }) {
  const note =
    entry.display === "holiday"
      ? { icon: PartyPopper, text: `${entry.holidayName ?? "Company holiday"}. No attendance is expected.` }
      : entry.display === "weekly_off"
        ? { icon: CalendarOff, text: "Scheduled weekly off. No attendance is expected." }
        : entry.display === "absent"
          ? { icon: UserX, text: "No check-in was recorded on this working day, so it counts as an absence." }
          : { icon: Clock, text: "No check-in has been recorded for this day yet." };
  const Icon = note.icon;
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {note.text}
    </div>
  );
}

/** Everything known about one day, for the employee and for the admin reviewing it. */
export function AttendanceDetailsSheet({ entry, employee, open, onOpenChange }: AttendanceDetailsSheetProps) {
  const { db } = useAppData();
  const record = entry?.record ?? null;
  const policy = db.settings.attendance;
  const reviewer = record?.reviewedBy ? db.admins.find((a) => a.id === record.reviewedBy)?.fullName : undefined;

  const events: TimelineEvent[] = [];
  if (record?.checkIn) {
    events.push({
      icon: LogIn,
      tone: "bg-blue-100 text-blue-700",
      title: "Checked in",
      at: formatTime(record.checkIn),
      detail: record.isLate ? `${record.lateMinutes} minutes after the ${policy.officeStartTime} start.` : undefined,
    });
  }
  if (record?.checkOut) {
    events.push({
      icon: LogOut,
      tone: "bg-slate-200 text-slate-700",
      title: "Checked out",
      at: formatTime(record.checkOut),
      detail: `${formatDuration(record.workedMinutes)} worked.`,
    });
  } else if (record?.checkIn && !record.isToday) {
    events.push({
      icon: Clock,
      tone: "bg-yellow-100 text-yellow-700",
      title: "No check-out recorded",
      detail: describeIncomplete(record, policy),
    });
  }
  if (record?.approval === "pending") {
    events.push({
      icon: Clock,
      tone: "bg-orange-100 text-orange-700",
      title: "Waiting for approval",
      detail: record.isOpen && record.isToday ? "Available for review once you check out." : "An administrator will review this day.",
    });
  } else if (record?.approval === "approved") {
    events.push({
      icon: CircleCheck,
      tone: "bg-green-100 text-green-700",
      title: "Approved",
      at: record.reviewedAt ? formatDateTime(record.reviewedAt) : undefined,
      detail: [reviewer ? `By ${reviewer}.` : null, record.reviewNote].filter(Boolean).join(" ") || undefined,
    });
  } else if (record?.approval === "rejected") {
    events.push({
      icon: CircleX,
      tone: "bg-red-100 text-red-700",
      title: "Rejected",
      at: record.reviewedAt ? formatDateTime(record.reviewedAt) : undefined,
      detail: reviewer ? `By ${reviewer}.` : undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {entry && (
          <>
            <SheetHeader className="border-b p-6 pr-14">
              {employee && (
                <div className="mb-3 flex items-center gap-3">
                  <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {employee.id}, {employee.department}
                    </p>
                  </div>
                </div>
              )}
              <SheetTitle className="text-xl font-semibold">{formatDate(entry.date, "long")}</SheetTitle>
              <SheetDescription className="sr-only">
                Attendance details for {formatDate(entry.date, "long")}
              </SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AttendanceStatusBadge status={entry.attendanceStatus} />
                <ApprovalStatusBadge status={entry.approvalStatus} />
              </div>
            </SheetHeader>

            <div className="space-y-6 p-6">
              {!record ? (
                <NoRecordNote entry={entry} />
              ) : (
                <>
                  <dl className="grid grid-cols-3 gap-3">
                    {[
                      ["Check-in", formatTime(record.checkIn)],
                      ["Check-out", formatTime(record.checkOut)],
                      [
                        "Hours worked",
                        record.workedMinutes === null && record.isOpen && record.isToday
                          ? "In progress"
                          : formatDuration(record.workedMinutes),
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border bg-muted/30 p-3">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {record.approval === "rejected" && record.rejectionReason && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                      <p className="font-medium text-red-900">Reason for rejection</p>
                      <p className="mt-1 text-red-800">{record.rejectionReason}</p>
                    </div>
                  )}

                  {record.effectiveStatus === "incomplete" && record.approval !== "rejected" && (
                    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
                      {describeIncomplete(record, policy)}
                    </div>
                  )}

                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">Activity</h3>
                    <Timeline events={events} />
                  </section>

                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">Details</h3>
                    <DetailList
                      items={[
                        { label: "Day", value: formatWeekday(entry.date, "long") },
                        {
                          label: "Attendance",
                          value: ATTENDANCE_STATUS_META[entry.attendanceStatus].label,
                        },
                        {
                          label: "Late arrival",
                          value: record.isLate ? `${record.lateMinutes} minutes late` : "On time",
                          hidden: !record.checkIn,
                        },
                        { label: "Remarks", value: record.remarks ?? "—" },
                        { label: "Reviewed by", value: reviewer ?? "—", hidden: !record.reviewedAt },
                        {
                          label: "Reviewed on",
                          value: record.reviewedAt ? formatDateTime(record.reviewedAt) : "—",
                          hidden: !record.reviewedAt,
                        },
                        { label: "Review note", value: record.reviewNote ?? "—", hidden: !record.reviewNote },
                      ]}
                    />
                  </section>
                </>
              )}
              <p className="text-xs text-muted-foreground">All times are shown in India Standard Time.</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
