"use client";

import { BellRing, Mail, Pencil, Phone } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { ProfileDetails } from "@/components/profile/ProfileDetails";
import { ProfileStatusBadge } from "@/components/profile/ProfileStatusBadge";
import { Spinner } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { monthOf } from "@/lib/date-utils";
import { completedSectionCount, contentOf } from "@/lib/profile-utils";
import { sendProfileReminder } from "@/lib/services/profile-service";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatMonthYear,
  formatTenure,
  formatUnits,
} from "@/lib/format";
import { selectEmployeeMonth } from "@/lib/selectors/employee";
import { ACCOUNT_STATUS_META } from "@/lib/status-config";
import type { Employee } from "@/types/employee";

interface EmployeeProfileDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: Employee) => void;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function EmployeeProfileDialog({ employee, open, onOpenChange, onEdit }: EmployeeProfileDialogProps) {
  const { db, ctx, today } = useAppData();
  const { year, month } = monthOf(today);

  const monthView = useMemo(
    () => (employee ? selectEmployeeMonth(db, ctx, employee.id, year, month) : null),
    [db, ctx, employee, year, month],
  );

  const [sendReminder, reminding] = useAction(sendProfileReminder);
  const remind = async () => {
    if (!employee) return;
    const result = await sendReminder(employee.id);
    if (result.ok) toast.success("Reminder sent", { description: `${employee.fullName} will see it in their notifications.` });
    else toast.error("Couldn't send the reminder", { description: result.error });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-6 overflow-y-auto sm:max-w-2xl">
        {employee && (
          <>
            <DialogHeader className="gap-4">
              <div className="flex items-center gap-4">
                <UserAvatar name={employee.fullName} photo={employee.photoUrl} size="xl" />
                <div className="min-w-0 space-y-1.5">
                  <DialogTitle className="text-xl font-semibold">{employee.fullName}</DialogTitle>
                  <DialogDescription>
                    {employee.designation}, {employee.department}
                  </DialogDescription>
                  <StatusBadge meta={ACCOUNT_STATUS_META[employee.status]} />
                </div>
              </div>
            </DialogHeader>

            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Fact label="Employee ID" value={employee.id} />
              <Fact
                label="Joined"
                value={
                  <>
                    {formatDate(employee.joiningDate)}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({formatTenure(employee.joiningDate, employee.deactivatedOn ?? today)})
                    </span>
                  </>
                }
              />
              <Fact
                label="Email"
                value={
                  <span className="inline-flex items-center gap-1.5 break-all">
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {employee.email}
                  </span>
                }
              />
              <Fact
                label="Phone"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {employee.phone}
                  </span>
                }
              />
              <Fact label="Monthly basic salary" value={formatCurrency(employee.monthlyBasicSalary)} />
              {employee.deactivatedOn && <Fact label="Deactivated on" value={formatDate(employee.deactivatedOn)} />}
            </dl>

            {monthView && (
              <section className="rounded-lg border bg-muted/30 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">{formatMonthYear(year, month)} so far</h3>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Fact label="Approved days" value={formatUnits(monthView.summary.approvedDays)} />
                  <Fact label="Pending" value={monthView.summary.pendingDays + monthView.summary.incompleteDays} />
                  <Fact label="Hours worked" value={formatDuration(monthView.summary.workedMinutes)} />
                  <Fact label="Estimated salary" value={formatCurrency(monthView.salary.estimatedSalary)} />
                </dl>
              </section>
            )}

            <section className="space-y-4 border-t pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Employee profile</h3>
                  <ProfileStatusBadge employee={employee} />
                </div>
                {employee.profile?.submittedAt && (
                  <p className="text-xs text-muted-foreground">Submitted {formatDateTime(employee.profile.submittedAt)}</p>
                )}
              </div>
              {employee.profile?.state === "submitted" ? (
                <ProfileDetails content={contentOf(employee.profile)} today={today} plain />
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p>
                    {employee.profile
                      ? `${employee.fullName} has saved a draft (${completedSectionCount(employee, today)} of 5 sections done) but has not submitted it.`
                      : `${employee.fullName} has not started their profile yet. They will be asked for it the next time they sign in.`}
                  </p>
                  {employee.status === "active" && (
                    <Button type="button" variant="outline" size="sm" onClick={remind} disabled={reminding}>
                      {reminding ? <Spinner /> : <BellRing className="size-4" aria-hidden />}
                      Send reminder
                    </Button>
                  )}
                </div>
              )}
            </section>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(employee);
                }}
              >
                <Pencil className="size-4" aria-hidden />
                Edit Employee
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
