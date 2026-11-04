import type { ReactNode } from "react";
import { formatDate, formatYearMonth } from "@/lib/format";
import {
  experienceMonths,
  formatAddress,
  formatExperience,
  maskAccountNumber,
  maskPan,
} from "@/lib/profile-utils";
import { GENDERS, MARITAL_STATUSES, RELATIONSHIPS, labelFor } from "@/lib/profile-options";
import { cn } from "@/lib/utils";
import type { DateKey } from "@/types/common";
import type { ProfileContent } from "@/types/profile";

const EMPTY = "Not provided";

export function Fact({ label, value, className }: { label: string; value?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-foreground">
        {value || <span className="font-normal text-muted-foreground">{EMPTY}</span>}
      </dd>
    </div>
  );
}

export function DetailSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10", className)}>
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

interface ProfileDetailsProps {
  content: ProfileContent;
  today: DateKey;
  /** Drops the card chrome, for use inside a dialog. */
  plain?: boolean;
}

/**
 * Read-only view of a profile. Bank account and PAN are masked everywhere in
 * the demo; a real system would show the full number only to people who need it.
 */
export function ProfileDetails({ content, today, plain }: ProfileDetailsProps) {
  const { personal, education, experience, emergency, bank } = content;
  const months = experience.isFresher ? 0 : experienceMonths(experience.entries, today);
  const Section = plain ? PlainSection : DetailSection;

  return (
    <div className={cn("grid gap-4", plain && "gap-6")}>
      <Section title="Personal details">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Date of birth" value={personal.dateOfBirth ? formatDate(personal.dateOfBirth) : ""} />
          <Fact label="Gender" value={labelFor(GENDERS, personal.gender)} />
          <Fact label="Marital status" value={labelFor(MARITAL_STATUSES, personal.maritalStatus)} />
          <Fact label="Blood group" value={personal.bloodGroup} />
          <Fact label="Personal email" value={personal.personalEmail} className="sm:col-span-2" />
          <Fact label="Current address" value={formatAddress(personal.currentAddress)} className="sm:col-span-2 lg:col-span-3" />
          <Fact
            label="Permanent address"
            value={personal.permanentSameAsCurrent ? "Same as current address" : formatAddress(personal.permanentAddress)}
            className="sm:col-span-2 lg:col-span-3"
          />
        </dl>
      </Section>

      <Section title="Education">
        {education.length === 0 ? (
          <p className="text-sm text-muted-foreground">No qualifications added yet.</p>
        ) : (
          <ul className="divide-y">
            {education.map((entry) => (
              <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-foreground">
                  {entry.degree}
                  {entry.fieldOfStudy && <span className="font-normal text-muted-foreground">, {entry.fieldOfStudy}</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {entry.institution}
                  {entry.yearOfPassing && `, ${entry.yearOfPassing}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Work experience">
        <dl className="mb-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Previous experience" value={formatExperience(months)} />
          <Fact label="Skills" value={experience.skills.join(", ")} className="sm:col-span-2" />
          {experience.summary && <Fact label="About" value={experience.summary} className="sm:col-span-2 lg:col-span-3" />}
        </dl>
        {experience.isFresher ? (
          <p className="text-sm text-muted-foreground">Fresher. No previous employers.</p>
        ) : experience.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No previous employers added yet.</p>
        ) : (
          <ol className="space-y-4 border-l pl-4">
            {experience.entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute top-1.5 -left-[1.3125rem] size-2.5 rounded-full bg-primary ring-4 ring-card" aria-hidden />
                <p className="text-sm font-medium text-foreground">
                  {entry.designation}
                  <span className="font-normal text-muted-foreground">, {entry.company}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.from ? formatYearMonth(entry.from) : ""} to {entry.current ? "Present" : entry.to ? formatYearMonth(entry.to) : ""}
                </p>
                {entry.responsibilities && <p className="mt-1 text-sm text-muted-foreground">{entry.responsibilities}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Emergency contact">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
          <Fact label="Name" value={emergency.name} />
          <Fact label="Relationship" value={labelFor(RELATIONSHIPS, emergency.relationship)} />
          <Fact label="Phone" value={emergency.phone} />
        </dl>
      </Section>

      <Section title="Bank and statutory details">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Account holder" value={bank.accountHolder} />
          <Fact label="Bank" value={bank.bankName} />
          <Fact label="Account number" value={maskAccountNumber(bank.accountNumber)} />
          <Fact label="IFSC" value={bank.ifsc} />
          <Fact label="PAN" value={maskPan(bank.pan)} />
          <Fact label="UAN" value={bank.uan} />
        </dl>
      </Section>
    </div>
  );
}

function PlainSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}
