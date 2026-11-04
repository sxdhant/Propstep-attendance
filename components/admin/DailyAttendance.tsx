"use client";

import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { DayStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppData } from "@/hooks/use-app-data";
import { attendanceId, buildDayEntry } from "@/lib/attendance-utils";
import { addDays, monthStart } from "@/lib/date-utils";
import { formatDate, formatDuration, formatTime, formatWeekday } from "@/lib/format";
import { getDataWindowStart } from "@/lib/selectors/context";

/** Read-only roster of every employee's attendance for one chosen day. */
export function DailyAttendance() {
  const { db, ctx, today } = useAppData();
  const earliest = useMemo(() => {
    const start = getDataWindowStart(db);
    return monthStart(start.year, start.month);
  }, [db]);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");

  const day = date > today ? today : date < earliest ? earliest : date;

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.employees
      .filter((e) => !query || e.fullName.toLowerCase().includes(query) || e.id.toLowerCase().includes(query))
      .map((employee) => ({
        employee,
        entry: buildDayEntry(employee, day, db.attendance[attendanceId(employee.id, day)], ctx),
      }))
      .filter(({ entry }) => entry.isEmployed)
      .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName));
  }, [db, ctx, day, search]);

  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center gap-3 p-5">
        <Button variant="outline" size="icon" aria-label="Previous day" disabled={day <= earliest} onClick={() => setDate(addDays(day, -1))}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Input
          type="date"
          aria-label="Attendance date"
          value={day}
          min={earliest}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-44"
        />
        <Button variant="outline" size="icon" aria-label="Next day" disabled={day >= today} onClick={() => setDate(addDays(day, 1))}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" disabled={day === today} onClick={() => setDate(today)}>
          Today
        </Button>
        <p className="text-sm font-medium text-foreground">
          {formatWeekday(day, "long")}, {formatDate(day, "long")}
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by employee name or ID"
          aria-label="Search employees"
          className="w-full sm:ml-auto sm:w-72"
        />
      </header>

      {rows.length === 0 ? (
        <div className="border-t">
          <EmptyState icon={Users} title="No employees to show" description="No one was employed on this day, or nobody matches the search." />
        </div>
      ) : (
        <div className="overflow-x-auto border-t">
          <Table className="min-w-[760px] text-[0.8125rem]">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Employee</TableHead>
                <TableHead className="px-3">Department</TableHead>
                <TableHead className="px-3">Check-in</TableHead>
                <TableHead className="px-3">Check-out</TableHead>
                <TableHead className="px-3 text-right">Duration</TableHead>
                <TableHead className="px-3">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ employee, entry }) => (
                <TableRow key={employee.id}>
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{employee.fullName}</p>
                        <p className="text-xs text-muted-foreground">{employee.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3">{employee.department}</TableCell>
                  <TableCell className="px-3">{formatTime(entry.record?.checkIn ?? null)}</TableCell>
                  <TableCell className="px-3">{formatTime(entry.record?.checkOut ?? null)}</TableCell>
                  <TableCell className="px-3 text-right">{formatDuration(entry.record?.workedMinutes ?? null)}</TableCell>
                  <TableCell className="px-3">
                    <DayStatusBadge status={entry.display} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
