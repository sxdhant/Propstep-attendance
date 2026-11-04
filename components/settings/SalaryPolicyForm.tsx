"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { NumberInput } from "@/components/shared/NumberInput";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { HALF_DAY_RULES } from "@/lib/constants";
import { formatCurrency, formatUnits } from "@/lib/format";
import { calculateSalary, SALARY_EXAMPLE } from "@/lib/salary-calculator";
import { saveSettings } from "@/lib/services/settings-service";
import { salaryPolicySchema, type SalaryPolicyValues } from "@/lib/validation/schemas";
import type { DivisorPolicy } from "@/types/payroll";

const FORM_ID = "salary-policy-form";

const DIVISOR_CHOICES: Array<{ value: DivisorPolicy; title: string; hint: string }> = [
  { value: "scheduled_working_days", title: "Scheduled working days", hint: "Recommended. Divides by the month's working days." },
  { value: "calendar_days", title: "Calendar days", hint: "Divides by 28 to 31, whatever the month has." },
  { value: "fixed", title: "Fixed divisor", hint: "Divides by the same number every month." },
];

export function SalaryPolicyForm() {
  const { db } = useAppData();
  const [save, saving] = useAction(saveSettings<"salary">);

  const form = useForm<SalaryPolicyValues>({
    resolver: zodResolver(salaryPolicySchema),
    defaultValues: db.settings.salary,
  });

  const policy = useWatch({ control: form.control });

  const submit = form.handleSubmit(async (values) => {
    const result = await save("salary", values);
    if (!result.ok) {
      toast.error("Couldn't save settings", { description: result.error });
      return;
    }
    form.reset(values);
    toast.success("Salary policy saved", { description: "Draft payroll and every estimate now use the new rules." });
  });

  // The preview applies the unsaved choices to the brief's worked example, so the effect is visible before saving.
  const preview = calculateSalary(SALARY_EXAMPLE, {
    divisorPolicy: policy.divisorPolicy ?? "scheduled_working_days",
    fixedDivisor: Number.isFinite(policy.fixedDivisor) ? (policy.fixedDivisor as number) : 26,
    halfDayUnits: policy.halfDayUnits ?? 0.5,
    payDay: policy.payDay ?? 5,
  });

  return (
    <SettingsSection
      title="Salary policy"
      description="How approved attendance is turned into an estimated salary."
      formId={FORM_ID}
      dirty={form.formState.isDirty}
      saving={saving}
      onDiscard={() => form.reset(db.settings.salary)}
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <FieldGroup className="gap-6">
          <Controller
            name="divisorPolicy"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel>Default salary divisor</FieldLabel>
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2">
                  {DIVISOR_CHOICES.map((choice) => (
                    <label
                      key={choice.value}
                      htmlFor={`divisor-${choice.value}`}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent/50"
                    >
                      <RadioGroupItem id={`divisor-${choice.value}`} value={choice.value} className="mt-0.5" />
                      <span>
                        <span className="block font-medium">{choice.title}</span>
                        <span className="block text-xs text-muted-foreground">{choice.hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </Field>
            )}
          />

          <div className="grid gap-6 sm:grid-cols-3">
            <Controller
              name="fixedDivisor"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="salary-fixed">Fixed divisor</FieldLabel>
                  <NumberInput
                    id="salary-fixed"
                    min={1}
                    max={31}
                    step={1}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    disabled={policy.divisorPolicy !== "fixed"}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription>Used only with a fixed divisor.</FieldDescription>
                  )}
                </Field>
              )}
            />
            <Controller
              name="halfDayUnits"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="salary-half">Half-day rule</FieldLabel>
                  <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger id="salary-half" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HALF_DAY_RULES.map((rule) => (
                        <SelectItem key={rule.value} value={String(rule.value)}>
                          {rule.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Controller
              name="payDay"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="salary-payday">Payment day</FieldLabel>
                  <NumberInput
                    id="salary-payday"
                    min={1}
                    max={28}
                    step={1}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription>Day of the next month.</FieldDescription>
                  )}
                </Field>
              )}
            />
          </div>

          <div className="rounded-lg bg-accent/60 p-4">
            <p className="text-xs font-medium text-accent-foreground">Preview with these settings</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {SALARY_EXAMPLE.approvedFullDays} full days and {SALARY_EXAMPLE.approvedHalfDays} half day on a{" "}
              {formatCurrency(SALARY_EXAMPLE.monthlyBasicSalary)} basic, in a month with {SALARY_EXAMPLE.scheduledWorkingDays}{" "}
              working days and {SALARY_EXAMPLE.calendarDays} calendar days:
            </p>
            <p className="mt-2 text-base font-semibold text-foreground tabular-nums">
              {formatCurrency(SALARY_EXAMPLE.monthlyBasicSalary)} × {formatUnits(preview.payableUnits)} ÷ {preview.divisor} ={" "}
              <span className="text-primary">{formatCurrency(preview.estimatedSalary)}</span>
            </p>
          </div>
        </FieldGroup>
      </form>
    </SettingsSection>
  );
}
