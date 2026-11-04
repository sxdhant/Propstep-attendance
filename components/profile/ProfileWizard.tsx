"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Save, Send } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { FormProvider, useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { ProfileDetails } from "@/components/profile/ProfileDetails";
import { EducationStep, EmergencyBankStep, ExperienceStep, PersonalStep } from "@/components/profile/ProfileSteps";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { contentOf, emptyEducation, emptyExperience, sectionCompletion } from "@/lib/profile-utils";
import { saveProfileDraft, submitProfile } from "@/lib/services/profile-service";
import { createProfileSchemas } from "@/lib/validation/profile-schemas";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types/employee";
import type { ProfileContent, ProfileSection } from "@/types/profile";

interface Step {
  key: string;
  title: string;
  /** Top-level form sections this step edits, used to validate it and to find errors. */
  sections: ProfileSection[];
}

const STEPS: Step[] = [
  { key: "personal", title: "Personal", sections: ["personal"] },
  { key: "education", title: "Education", sections: ["education"] },
  { key: "experience", title: "Experience", sections: ["experience"] },
  { key: "emergency", title: "Emergency and bank", sections: ["emergency", "bank"] },
  { key: "review", title: "Review", sections: [] },
];
const LAST = STEPS.length - 1;
const TOP_ID = "profile-form-top";

interface ProfileWizardProps {
  employee: Employee;
  /** `onboarding` saves drafts and has no way out; `edit` updates a submitted profile. */
  mode: "onboarding" | "edit";
  onDone: () => void;
  onCancel?: () => void;
}

export function ProfileWizard({ employee, mode, onDone, onCancel }: ProfileWizardProps) {
  const { today } = useAppData();
  const schemas = useMemo(() => createProfileSchemas(today), [today]);
  const [step, setStep] = useState(0);

  const form = useForm<ProfileContent>({
    resolver: zodResolver(schemas.full) as unknown as Resolver<ProfileContent>,
    defaultValues: (() => {
      const content = contentOf(employee.profile);
      if (content.education.length === 0) content.education = [emptyEducation()];
      // Start with one blank employer row so the step never looks empty. "I'm a fresher" removes it.
      if (!content.experience.isFresher && content.experience.entries.length === 0) {
        content.experience.entries = [emptyExperience()];
      }
      return content;
    })(),
    shouldFocusError: true,
  });

  const [saveDraft, savingDraft] = useAction(async (values: ProfileContent) => saveProfileDraft(employee.id, values));
  const [submit, submitting] = useAction(async (values: ProfileContent) => submitProfile(employee.id, values));

  const goTo = (index: number) => {
    setStep(index);
    requestAnimationFrame(() => document.getElementById(TOP_ID)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  const next = async () => {
    const valid = await form.trigger(STEPS[step].sections);
    if (!valid) return;
    if (mode === "onboarding") void saveDraft(form.getValues());
    goTo(step + 1);
  };

  const keepDraft = async () => {
    const result = await saveDraft(form.getValues());
    if (result.ok) toast.success("Draft saved", { description: "You can pick this up later from where you left off." });
    else toast.error("Couldn't save the draft", { description: result.error });
  };

  const onInvalid = (errors: FieldErrors<ProfileContent>) => {
    const first = STEPS.findIndex((s) => s.sections.some((section) => errors[section]));
    if (first >= 0) goTo(first);
    toast.error("Some details need attention", { description: "Fix the highlighted fields, then submit again." });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await submit(values);
    if (!result.ok) {
      toast.error("Couldn't submit your profile", { description: result.error });
      return;
    }
    toast.success(mode === "onboarding" ? "Profile submitted" : "Profile updated", {
      description: mode === "onboarding" ? "You're all set. Your dashboard is ready." : "Your administrators have been told.",
    });
    onDone();
  }, onInvalid);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Pressing Enter in a field should move on, not submit half a form.
    if (step < LAST) void next();
    else void onSubmit(event);
  };

  const busy = savingDraft || submitting;

  return (
    <FormProvider {...form}>
      <div id={TOP_ID} className="scroll-mt-20" />
      <Stepper step={step} onGo={goTo} />

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        <div className="rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10 sm:p-6">
          {step === 0 && <PersonalStep />}
          {step === 1 && <EducationStep />}
          {step === 2 && <ExperienceStep />}
          {step === 3 && <EmergencyBankStep />}
          {step === 4 && <ReviewStep onEdit={goTo} />}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={busy}>
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
            ) : (
              mode === "edit" &&
              onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                  Cancel
                </Button>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === "onboarding" && (
              <Button type="button" variant="ghost" onClick={keepDraft} disabled={busy}>
                {savingDraft ? <Spinner /> : <Save className="size-4" aria-hidden />}
                Save draft
              </Button>
            )}
            {step < LAST ? (
              <Button type="submit" disabled={busy}>
                Continue
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button type="submit" disabled={busy}>
                {submitting ? <Spinner /> : <Send className="size-4" aria-hidden />}
                {mode === "onboarding" ? "Submit profile" : "Update profile"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

function Stepper({ step, onGo }: { step: number; onGo: (index: number) => void }) {
  return (
    <nav aria-label="Profile steps">
      <p className="mb-2 text-sm text-muted-foreground sm:hidden">
        Step {step + 1} of {STEPS.length}: <span className="font-medium text-foreground">{STEPS[step].title}</span>
      </p>
      <ol className="flex gap-1.5 sm:gap-2">
        {STEPS.map((item, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={index > step}
                onClick={() => onGo(index)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:px-3",
                  active && "border-primary bg-accent text-accent-foreground",
                  done && "bg-card text-foreground hover:bg-muted",
                  !active && !done && "border-dashed bg-transparent text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    active ? "bg-primary text-primary-foreground" : done ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span className="hidden min-w-0 truncate font-medium sm:block">{item.title}</span>
                <span className="sr-only sm:hidden">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ReviewStep({ onEdit }: { onEdit: (index: number) => void }) {
  const { today } = useAppData();
  const content = useWatch() as ProfileContent;
  const done = sectionCompletion(content, today);
  const missing = STEPS.filter((s) => s.sections.some((section) => !done[section]) && s.key !== "review");

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Review and submit</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">Check everything below. You can change it later from My Profile.</p>

      {missing.length > 0 && (
        <div role="alert" className="mb-5 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          <p className="font-medium">Finish these before you submit:</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {missing.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => onEdit(STEPS.indexOf(s))}
                  className="rounded underline underline-offset-2 hover:no-underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProfileDetails content={content} today={today} plain />
    </div>
  );
}
