"use client";

import { ClipboardList, Mail, Pencil, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProfileDetails } from "@/components/profile/ProfileDetails";
import { ProfileStatusBadge } from "@/components/profile/ProfileStatusBadge";
import { ProfileWizard } from "@/components/profile/ProfileWizard";
import { PageHeader } from "@/components/shared/PageHeader";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/hooks/use-app-data";
import { HOME_BY_ROLE } from "@/lib/constants";
import { formatDate, formatTenure, getFirstName } from "@/lib/format";
import { contentOf, getProfileStatus } from "@/lib/profile-utils";

export function EmployeeProfileView() {
  const { employee, today } = useAppData();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const complete = getProfileStatus(employee) === "complete";
  const showForm = !complete || editing;

  return (
    <div className="space-y-6">
      <PageHeader
        title={complete ? "My Profile" : "Complete your profile"}
        description={
          complete
            ? "Your personal, education, work and bank details. Your administrators can see them too."
            : "A few details about you and your work. It takes about five minutes."
        }
        actions={
          complete &&
          !editing && (
            <Button onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              Edit profile
            </Button>
          )
        }
      />

      {!complete && (
        <Alert>
          <ClipboardList aria-hidden />
          <AlertTitle>Welcome, {getFirstName(employee.fullName)}</AlertTitle>
          <AlertDescription>
            Attendance, salary and notifications open as soon as you submit this form. You can save a draft and come
            back to it at any time.
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10 sm:flex-row sm:items-center">
        <UserAvatar name={employee.fullName} size="xl" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{employee.fullName}</h2>
            <ProfileStatusBadge employee={employee} />
          </div>
          <p className="text-sm text-muted-foreground">
            {employee.designation}, {employee.department}
          </p>
          <p className="text-sm text-muted-foreground">
            {employee.id}. Joined {formatDate(employee.joiningDate)}
            {employee.joiningDate < today && ` (${formatTenure(employee.joiningDate, today)})`}
          </p>
        </div>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2 break-all">
            <Mail className="size-4 shrink-0" aria-hidden />
            {employee.email}
          </li>
          <li className="flex items-center gap-2">
            <Phone className="size-4 shrink-0" aria-hidden />
            {employee.phone}
          </li>
        </ul>
      </section>

      {showForm ? (
        <ProfileWizard
          key={employee.id}
          employee={employee}
          mode={complete ? "edit" : "onboarding"}
          onCancel={() => setEditing(false)}
          onDone={() => {
            if (complete) setEditing(false);
            else router.push(HOME_BY_ROLE.employee);
          }}
        />
      ) : (
        <ProfileDetails content={contentOf(employee.profile)} today={today} />
      )}
    </div>
  );
}
