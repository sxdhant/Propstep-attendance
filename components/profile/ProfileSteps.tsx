"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { CheckField, SelectField, SkillsField, TextAreaField, TextField } from "@/components/profile/fields";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useAppData } from "@/hooks/use-app-data";
import { addDays } from "@/lib/date-utils";
import {
  BLOOD_GROUPS,
  DEGREES,
  GENDERS,
  INDIAN_STATES,
  MARITAL_STATUSES,
  RELATIONSHIPS,
} from "@/lib/profile-options";
import { emptyEducation, emptyExperience, experienceMonths, formatExperience } from "@/lib/profile-utils";
import type { ProfileContent } from "@/types/profile";

const digitsOnly = (value: string) => value.replace(/\D/g, "");
const upper = (value: string) => value.toUpperCase();

function StepIntro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

function AddressFields({ prefix, label }: { prefix: string; label: string }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField name={`${prefix}.line1`} label={`${label} address`} placeholder="House or flat, street, area" className="sm:col-span-2" autoComplete="street-address" />
      <TextField name={`${prefix}.city`} label="City" autoComplete="address-level2" />
      <SelectField name={`${prefix}.state`} label="State" options={INDIAN_STATES} placeholder="Choose a state" />
      <TextField name={`${prefix}.pincode`} label="PIN code" inputMode="numeric" maxLength={6} transform={digitsOnly} autoComplete="postal-code" />
    </div>
  );
}

export function PersonalStep() {
  const { control } = useFormContext<ProfileContent>();
  const same = useWatch({ control, name: "personal.permanentSameAsCurrent" });
  const { today } = useAppData();

  return (
    <div className="space-y-8">
      <div>
        <StepIntro title="Personal details">Used for HR records. Only you and your administrators can see them.</StepIntro>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="personal.dateOfBirth" label="Date of birth" type="date" max={addDays(today, -365 * 18)} />
          <SelectField name="personal.gender" label="Gender" options={GENDERS} />
          <SelectField name="personal.maritalStatus" label="Marital status" options={MARITAL_STATUSES} />
          <SelectField name="personal.bloodGroup" label="Blood group (optional)" options={BLOOD_GROUPS} clearLabel="Not sure" placeholder="Choose" />
          <TextField
            name="personal.personalEmail"
            label="Personal email (optional)"
            type="email"
            placeholder="name@example.com"
            description="A backup address for payslips and account recovery."
            className="sm:col-span-2"
          />
        </div>
      </div>

      <div>
        <StepIntro title="Address" />
        <div className="space-y-5">
          <AddressFields prefix="personal.currentAddress" label="Current" />
          <CheckField name="personal.permanentSameAsCurrent" label="My permanent address is the same as my current address" />
          {!same && <AddressFields prefix="personal.permanentAddress" label="Permanent" />}
        </div>
      </div>
    </div>
  );
}

export function EducationStep() {
  const { control, formState } = useFormContext<ProfileContent>();
  const { fields, append, remove } = useFieldArray({ control, name: "education" });
  const rootError = (formState.errors.education as { message?: string; root?: { message?: string } } | undefined);
  const message = rootError?.root?.message ?? rootError?.message;

  return (
    <div>
      <StepIntro title="Education">Start with your highest qualification.</StepIntro>
      <div className="space-y-4">
        {fields.map((item, index) => (
          <fieldset key={item.id} className="rounded-lg border p-4">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Qualification {index + 1}</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField name={`education.${index}.degree`} label="Qualification" options={DEGREES} />
              <TextField name={`education.${index}.fieldOfStudy`} label="Course or specialisation" placeholder="For example, Computer Science" />
              <TextField name={`education.${index}.institution`} label="School, college or university" className="sm:col-span-2" />
              <TextField name={`education.${index}.yearOfPassing`} label="Year of passing" inputMode="numeric" maxLength={4} transform={digitsOnly} placeholder="2022" />
            </div>
            {fields.length > 1 && (
              <div className="mt-3 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                  <Trash2 className="size-4" aria-hidden />
                  Remove
                </Button>
              </div>
            )}
          </fieldset>
        ))}
      </div>
      {message && <FieldError className="mt-3">{message}</FieldError>}
      {fields.length < 8 && (
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append(emptyEducation())}>
          <Plus className="size-4" aria-hidden />
          Add another qualification
        </Button>
      )}
    </div>
  );
}

export function ExperienceStep() {
  const { control, formState, getValues } = useFormContext<ProfileContent>();
  const { today } = useAppData();
  const { fields, append, remove, replace } = useFieldArray({ control, name: "experience.entries" });
  const isFresher = useWatch({ control, name: "experience.isFresher" });
  const entries = useWatch({ control, name: "experience.entries" });
  const rootError = formState.errors.experience?.entries as { message?: string; root?: { message?: string } } | undefined;
  const message = rootError?.root?.message ?? rootError?.message;

  return (
    <div className="space-y-8">
      <div>
        <StepIntro title="Work experience">Tell us where you have worked before, newest first.</StepIntro>
        <CheckField
          name="experience.isFresher"
          label="I'm a fresher with no previous employers"
          onChange={(checked) => {
            // A fresher has no employers, so nothing hidden is left to fail validation.
            if (checked) replace([]);
            else if (getValues("experience.entries").length === 0) append(emptyExperience());
          }}
        />

        {!isFresher && (
          <div className="mt-5 space-y-4">
            {fields.map((item, index) => (
              <fieldset key={item.id} className="rounded-lg border p-4">
                <legend className="px-1 text-xs font-medium text-muted-foreground">Employer {index + 1}</legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField name={`experience.entries.${index}.company`} label="Company" />
                  <TextField name={`experience.entries.${index}.designation`} label="Your role" placeholder="For example, Software Engineer" />
                  <TextField name={`experience.entries.${index}.from`} label="Start date" type="date" max={today} />
                  <TextField
                    name={`experience.entries.${index}.to`}
                    label="End date"
                    type="date"
                    max={today}
                    disabled={Boolean(entries?.[index]?.current)}
                  />
                  <CheckField name={`experience.entries.${index}.current`} label="I currently work here" className="sm:col-span-2" />
                  <TextAreaField
                    name={`experience.entries.${index}.responsibilities`}
                    label="What you did (optional)"
                    maxLength={400}
                    className="sm:col-span-2"
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                    <Trash2 className="size-4" aria-hidden />
                    Remove
                  </Button>
                </div>
              </fieldset>
            ))}
            {message && <FieldError>{message}</FieldError>}
            {fields.length < 10 && (
              <Button type="button" variant="outline" size="sm" onClick={() => append(emptyExperience())}>
                <Plus className="size-4" aria-hidden />
                Add {fields.length ? "another employer" : "an employer"}
              </Button>
            )}
            {entries?.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Total previous experience: <span className="font-medium text-foreground">{formatExperience(experienceMonths(entries, today))}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <StepIntro title="Skills and summary" />
        <div className="space-y-5">
          <SkillsField name="experience.skills" label="Skills" description="Press Enter or a comma after each skill." />
          <TextAreaField
            name="experience.summary"
            label="About you (optional)"
            placeholder="A few lines about your strengths and what you enjoy working on."
            maxLength={500}
          />
        </div>
      </div>
    </div>
  );
}

export function EmergencyBankStep() {
  return (
    <div className="space-y-8">
      <div>
        <StepIntro title="Emergency contact">Someone we can call if we can&apos;t reach you.</StepIntro>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="emergency.name" label="Contact name" autoComplete="off" />
          <SelectField name="emergency.relationship" label="Relationship" options={RELATIONSHIPS} />
          <TextField name="emergency.phone" label="Phone number" type="tel" placeholder="+91 98765 43210" />
        </div>
      </div>

      <div>
        <StepIntro title="Bank and statutory details">
          Used by your administrator to pay your salary. Only you and administrators can see these details.
        </StepIntro>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="bank.accountHolder" label="Name on the account" />
          <TextField name="bank.bankName" label="Bank name" />
          <TextField name="bank.accountNumber" label="Account number" inputMode="numeric" maxLength={18} transform={digitsOnly} />
          <TextField name="bank.ifsc" label="IFSC code" maxLength={11} transform={upper} placeholder="HDFC0001234" />
          <TextField name="bank.pan" label="PAN (optional)" maxLength={10} transform={upper} placeholder="ABCDE1234F" />
          <TextField name="bank.uan" label="UAN (optional)" inputMode="numeric" maxLength={12} transform={digitsOnly} description="Your provident fund number, if you have one." />
        </div>
      </div>
    </div>
  );
}
