"use client";

import { Users, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/format";
import type { RosterRow, TodayRoster } from "@/lib/selectors/admin";
import { cn } from "@/lib/utils";

export type RosterKind = "total" | "present" | "absent";

const TITLES: Record<RosterKind, string> = {
  total: "All employees",
  present: "Present today",
  absent: "Absent today",
};

function Chip({ tone, children }: { tone: "green" | "yellow" | "red" | "gray" | "blue"; children: React.ReactNode }) {
  const styles = {
    green: "bg-green-50 text-green-800 ring-green-600/25",
    yellow: "bg-yellow-50 text-yellow-800 ring-yellow-600/25",
    red: "bg-red-50 text-red-800 ring-red-600/25",
    blue: "bg-blue-50 text-blue-800 ring-blue-600/25",
    gray: "bg-muted text-muted-foreground ring-foreground/10",
  } as const;
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset", styles[tone])}>
      {children}
    </span>
  );
}

function StatusChip({ row, cutoff }: { row: RosterRow; cutoff: string }) {
  const timing = row.record?.isLate ? (
    <Chip tone="yellow">Late by {row.record.lateMinutes} min</Chip>
  ) : (
    <Chip tone="green">On time</Chip>
  );
  switch (row.state) {
    case "present":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {timing}
          <Chip tone="green">Approved</Chip>
        </span>
      );
    case "awaiting":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {timing}
          <Chip tone="gray">Awaiting approval</Chip>
        </span>
      );
    case "absent":
      return <Chip tone="red">{row.reason ?? (row.record ? "Marked absent" : `No check-in by ${cutoff}`)}</Chip>;
    case "not_arrived":
      return <Chip tone="gray">Not checked in yet</Chip>;
    default:
      return <Chip tone="gray">{row.reason ?? "Not expected today"}</Chip>;
  }
}

/** The check-in time (and check-out, when there is one) for a row. */
function Times({ row }: { row: RosterRow }) {
  if (!row.record?.checkIn) return <span className="text-sm text-muted-foreground">No check-in</span>;
  return (
    <div className="text-right leading-tight">
      <p className="text-sm font-semibold text-foreground tabular-nums">{formatTime(row.record.checkIn)}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {row.record.checkOut ? `Out ${formatTime(row.record.checkOut)}` : "Still in"}
      </p>
    </div>
  );
}

interface TodayRosterPanelProps {
  id: string;
  kind: RosterKind;
  roster: TodayRoster;
  onClose: () => void;
  onSelect: (row: RosterRow) => void;
}

/**
 * The panel that opens under the stat cards: who is behind the number, with
 * each person's check-in time. Click a person to see their full day.
 */
export function TodayRosterPanel({ id, kind, roster, onClose, onSelect }: TodayRosterPanelProps) {
  const [search, setSearch] = useState("");

  // "Present" means checked in AND approved. Check-ins still waiting for a decision are listed under it
  // in their own group, so nobody who has arrived disappears from view.
  const source = useMemo(
    () =>
      kind === "present"
        ? [...roster.present, ...roster.awaiting]
        : kind === "absent"
          ? roster.absent
          : roster.all,
    [kind, roster],
  );
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter(
      ({ employee }) =>
        employee.fullName.toLowerCase().includes(query) ||
        employee.id.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query),
    );
  }, [source, search]);

  const others = roster.all.length - roster.present.length - roster.awaiting.length - roster.absent.length;
  const summary =
    kind === "total"
      ? `${roster.present.length} present, ${roster.awaiting.length} awaiting approval, ${roster.absent.length} absent, ${others} other`
      : kind === "present"
        ? `${roster.present.length} approved, ${roster.awaiting.length} awaiting approval`
        : `${source.length} ${source.length === 1 ? "employee" : "employees"}`;

  return (
    <section
      id={id}
      aria-label={TITLES[kind]}
      className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10 duration-200 animate-in fade-in-0 slide-in-from-top-2"
    >
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{TITLES[kind]}</h2>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {source.length > 6 && (
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, ID or department"
              aria-label="Search employees"
              className="h-9 w-56"
            />
          )}
          {kind === "total" && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/employees">Manage employees</Link>
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={`Close ${TITLES[kind].toLowerCase()}`}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            search
              ? "No one matches that search"
              : !roster.isWorkingDayToday && kind !== "total"
                ? "No attendance expected today"
                : kind === "absent"
                  ? "No one is absent"
                  : kind === "present"
                    ? "No one is present yet"
                    : "No employees yet"
          }
          description={
            search
              ? "Try a different name, ID or department."
              : !roster.isWorkingDayToday && kind !== "total"
                ? `Today is a ${roster.nonWorkingReason?.toLowerCase() ?? "non-working day"}.`
                : kind === "absent"
                ? `People are counted as absent if they haven't checked in by ${roster.absentCutoff} plus the grace period.`
                : kind === "present"
                  ? "People count as present once they have checked in and you have approved them."
                  : "Add employees from the Employees page."
          }
        />
      ) : (
        <ul className="max-h-[26rem] divide-y overflow-y-auto">
          {rows.map((row, index) => (
            <Fragment key={row.employee.id}>
              {kind === "present" && row.state === "awaiting" && rows[index - 1]?.state !== "awaiting" && (
                <li className="flex items-center justify-between gap-3 bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground">
                  <span>Checked in, waiting for your approval ({roster.awaiting.length})</span>
                  <Link href="/admin/attendance" className="font-medium text-primary hover:underline">
                    Review approvals
                  </Link>
                </li>
              )}
              <li>
              <button
                type="button"
                onClick={() => onSelect(row)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <UserAvatar name={row.employee.fullName} photo={row.employee.photoUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.employee.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.employee.id}, {row.employee.department}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <StatusChip row={row} cutoff={roster.absentCutoff} />
                </div>
                <div className="w-24 shrink-0 text-right">
                  <Times row={row} />
                </div>
              </button>
              <div className="px-5 pb-3 sm:hidden">
                <StatusChip row={row} cutoff={roster.absentCutoff} />
              </div>
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </section>
  );
}
