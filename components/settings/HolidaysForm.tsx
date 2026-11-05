"use client";

import { CalendarOff, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/hooks/use-app-data";
import { formatDate, formatWeekday } from "@/lib/format";
import { deleteHoliday, saveHoliday } from "@/lib/services/holiday-service";

/** Every day is a working day. Anything listed here is a paid day off that never counts as an absence. */
export function HolidaysForm() {
  const { db, today } = useAppData();
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const holidays = useMemo(() => [...db.holidays].sort((a, b) => a.date.localeCompare(b.date)), [db.holidays]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!date) return toast.error("Choose a date.");
    if (name.trim().length < 2) return toast.error("Enter a name, like Diwali or Day off.");
    setBusy("add");
    const result = await saveHoliday({ date, name: name.trim() });
    setBusy(null);
    if (!result.ok) return toast.error("Couldn't save the day off", { description: result.error });
    toast.success(`${formatDate(date)} is now a day off`);
    setName("");
  };

  const remove = async (target: string) => {
    setBusy(target);
    const result = await deleteHoliday(target);
    setBusy(null);
    if (!result.ok) return toast.error("Couldn't remove it", { description: result.error });
    toast.success(`${formatDate(target)} is a working day again`);
  };

  return (
    <section className="max-w-3xl overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <header className="border-b px-6 py-5">
        <h2 className="text-base font-semibold text-foreground">Holidays and days off</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every day of the month is a working day. Add a date here to make it a paid day off, and remove it to make it
          a working day again.
        </p>
      </header>

      <form onSubmit={add} className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" />
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          Name
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="For example, Diwali or Sunday off"
            autoComplete="off"
          />
        </label>
        <Button type="submit" disabled={busy !== null}>
          {busy === "add" && <Spinner />}
          Add day off
        </Button>
      </form>

      {holidays.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
          <CalendarOff className="size-6" aria-hidden />
          No days off yet. Every day counts as a working day.
        </div>
      ) : (
        <ul className="divide-y">
          {holidays.map((holiday) => (
            <li key={holiday.date} className="flex items-center justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{holiday.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatWeekday(holiday.date, "long")}, {formatDate(holiday.date)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${holiday.name}`}
                disabled={busy !== null}
                onClick={() => remove(holiday.date)}
              >
                {busy === holiday.date ? <Spinner /> : <Trash2 className="size-4" aria-hidden />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
