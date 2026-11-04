"use client";

import {
  CalendarOff,
  CircleCheck,
  Clock,
  Lock,
  LogIn,
  LogOut,
  PartyPopper,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { WorkdayTrack } from "@/components/attendance/WorkdayTrack";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { useTicker } from "@/hooks/use-store";
import { getElapsedMinutes, getWorkedMinutes } from "@/lib/attendance-utils";
import { minutesOfDay } from "@/lib/date-utils";
import { formatDate, formatDuration, formatTime, formatTimeWithSeconds, getFirstName } from "@/lib/format";
import { selectToday } from "@/lib/selectors/employee";
import { checkIn, checkOut } from "@/lib/services/attendance-service";
import { ATTENDANCE_STATUS_META } from "@/lib/status-config";
import type { RecordStatus } from "@/types/attendance";

const CHECKOUT_MESSAGE: Partial<Record<RecordStatus, string>> = {
  present: "A full day was recorded. It now waits for approval.",
  half_day: "Recorded as a half day. It now waits for approval.",
  incomplete: "That is under the half-day threshold, so the day is marked Incomplete.",
};

function PendingChip() {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-orange-400/15 px-2.5 text-xs font-medium text-orange-100 ring-1 ring-orange-300/30 ring-inset">
      <Clock className="size-3.5" aria-hidden />
      Pending Approval
    </span>
  );
}

export function CheckInCard() {
  const { db, ctx, employee } = useAppData();
  const tick = useTicker(1000);
  const [confirmEarly, setConfirmEarly] = useState(false);
  const [runCheckIn, checkingIn] = useAction(checkIn);
  const [runCheckOut, checkingOut] = useAction(checkOut);

  const view = useMemo(() => selectToday(db, ctx, employee.id), [db, ctx, employee.id]);
  if (!view || tick === null) return <Skeleton className="h-80 rounded-2xl" />;

  const policy = db.settings.attendance;
  const nowMs = tick + db.clockOffsetMs;
  const now = new Date(nowMs);
  const record = view.entry.record;
  const elapsed = record ? (getElapsedMinutes(record, nowMs) ?? 0) : 0;
  const requiredMinutes = policy.requiredWorkingHours * 60;
  const progress = Math.min(100, (elapsed / requiredMinutes) * 100);

  const handleCheckIn = async () => {
    const result = await runCheckIn({ employeeId: employee.id });
    if (!result.ok) {
      toast.error("Couldn't check in", { description: result.error });
      return;
    }
    toast.success(`Checked in at ${formatTime(result.data.checkIn)}`, {
      description: "Your attendance is now pending approval.",
    });
  };

  const performCheckOut = async () => {
    setConfirmEarly(false);
    const result = await runCheckOut({ employeeId: employee.id });
    if (!result.ok) {
      toast.error("Couldn't check out", { description: result.error });
      return;
    }
    toast.success(`Checked out at ${formatTime(result.data.checkOut)}`, {
      description: `${formatDuration(getWorkedMinutes(result.data))} worked. ${CHECKOUT_MESSAGE[result.data.status] ?? ""}`,
    });
  };

  const handleCheckOut = () => {
    if (elapsed < policy.halfDayThresholdHours * 60) setConfirmEarly(true);
    else void performCheckOut();
  };

  const nowMinutes = minutesOfDay(now);
  const checkInMinutes = record?.checkIn ? minutesOfDay(new Date(record.checkIn)) : null;
  const checkOutMinutes = record?.checkOut ? minutesOfDay(new Date(record.checkOut)) : null;

  let heading: React.ReactNode;
  let action: React.ReactNode = null;

  switch (view.state) {
    case "not_checked_in":
      heading = (
        <>
          <p className="text-5xl leading-none font-semibold tracking-tight tabular-nums sm:text-6xl">
            {formatTimeWithSeconds(now)}
          </p>
          <h2 className="mt-4 text-xl font-semibold">Ready to start your day?</h2>
          <p className="mt-1 max-w-md text-sm text-white/70">
            Check in to record your attendance. An administrator reviews it before it counts towards your salary.
          </p>
        </>
      );
      action = (
        <Button
          size="lg"
          onClick={handleCheckIn}
          disabled={checkingIn}
          className="h-12 w-full gap-2 bg-white px-8 text-base font-semibold text-ink hover:bg-white/90 lg:w-auto"
        >
          {checkingIn ? <Spinner /> : <LogIn className="size-5" aria-hidden />}
          Check In
        </Button>
      );
      break;

    case "checked_in":
      heading = (
        <>
          <p className="flex items-center gap-2 text-sm text-white/80">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-300 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-sky-300" />
            </span>
            You&apos;re checked in
          </p>
          <p className="mt-3 text-sm text-white/60">Check-in time</p>
          <p className="text-5xl leading-none font-semibold tracking-tight tabular-nums sm:text-6xl">
            {formatTime(record?.checkIn)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PendingChip />
            <span className="text-sm text-white/70">
              Working for <span className="font-medium text-white tabular-nums">{formatDuration(elapsed)}</span>
            </span>
          </div>
          <div className="mt-4 max-w-md">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-label="Progress towards the daily working hours"
            >
              <div className="h-full rounded-full bg-sky-300 transition-[width] duration-700" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/60 tabular-nums">
              {formatDuration(elapsed)} of {policy.requiredWorkingHours}h required
            </p>
          </div>
        </>
      );
      action = (
        <>
          <Button
            size="lg"
            onClick={handleCheckOut}
            disabled={checkingOut}
            className="h-12 w-full gap-2 bg-white px-8 text-base font-semibold text-ink hover:bg-white/90 lg:w-auto"
          >
            {checkingOut ? <Spinner /> : <LogOut className="size-5" aria-hidden />}
            Check Out
          </Button>
        </>
      );
      break;

    case "checked_out": {
      const status = record ? ATTENDANCE_STATUS_META[record.effectiveStatus] : null;
      heading = (
        <>
          <p className="flex items-center gap-2 text-sm font-medium text-white/90">
            <CircleCheck className="size-4 text-green-300" aria-hidden />
            Day complete
          </p>
          <dl className="mt-4 grid max-w-lg grid-cols-3 gap-4">
            {[
              ["Check-in", formatTime(record?.checkIn)],
              ["Check-out", formatTime(record?.checkOut)],
              ["Hours worked", formatDuration(record?.workedMinutes)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-white/60">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {status && (
              <span className="inline-flex h-6 items-center rounded-full bg-white/10 px-2.5 text-xs font-medium text-white/90 ring-1 ring-white/15 ring-inset">
                {status.label}
              </span>
            )}
            <PendingChip />
          </div>
          <p className="mt-3 text-sm text-white/60">You can check in again on the next working day.</p>
        </>
      );
      action = (
        <Button
          size="lg"
          disabled
          className="h-12 w-full gap-2 bg-white/15 px-8 text-base font-semibold text-white/80 disabled:opacity-100 lg:w-auto"
        >
          <CircleCheck className="size-5" aria-hidden />
          Checked Out
        </Button>
      );
      break;
    }

    case "non_working_day": {
      const isHoliday = view.entry.kind === "holiday";
      const Icon = isHoliday ? PartyPopper : CalendarOff;
      heading = (
        <>
          <span className="grid size-11 place-items-center rounded-full bg-white/10">
            <Icon className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-2xl font-semibold">
            {isHoliday ? `Today is a holiday: ${view.entry.holidayName}` : "Today is your weekly off"}
          </h2>
          <p className="mt-1 max-w-md text-sm text-white/70">
            Check-in is only available on working days. Enjoy the day off.
          </p>
          <p className="mt-3 text-sm text-white/60 tabular-nums">Current time {formatTimeWithSeconds(now)}</p>
        </>
      );
      break;
    }

    case "inactive_account":
      heading = (
        <>
          <span className="grid size-11 place-items-center rounded-full bg-white/10">
            <Lock className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-2xl font-semibold">{getFirstName(employee.fullName)}&apos;s account is deactivated</h2>
          <p className="mt-1 max-w-md text-sm text-white/70">
            Check-in is switched off for deactivated accounts. An administrator can reactivate it from the Employees page.
          </p>
        </>
      );
      break;
  }

  return (
    <>
      <section aria-label="Check in and check out" className="overflow-hidden rounded-2xl bg-ink text-ink-foreground shadow-xs">
        <div className="p-6 sm:p-8">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white/90">Today, {formatDate(ctx.today, "long")}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
              <Clock className="size-3.5" aria-hidden />
              Office hours {policy.officeStartTime} to {policy.officeEndTime}
            </span>
          </header>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>{heading}</div>
            {action && <div className="flex flex-col gap-3 lg:items-end">{action}</div>}
          </div>

          {view.state !== "inactive_account" && (
            <WorkdayTrack
              className="mt-8"
              officeStartTime={policy.officeStartTime}
              officeEndTime={policy.officeEndTime}
              nowMinutes={nowMinutes}
              checkInMinutes={checkInMinutes}
              checkOutMinutes={checkOutMinutes}
              showNow={view.state !== "checked_out"}
            />
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmEarly}
        onOpenChange={setConfirmEarly}
        title="Check out early?"
        description={`You've worked ${formatDuration(elapsed)} so far. Anything under ${policy.halfDayThresholdHours} hours is recorded as Incomplete and may be rejected.`}
        confirmLabel="Check Out Anyway"
        icon={LogOut}
        pending={checkingOut}
        onConfirm={performCheckOut}
      >
      </ConfirmDialog>
    </>
  );
}
