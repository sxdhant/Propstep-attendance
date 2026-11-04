"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { NumberInput } from "@/components/shared/NumberInput";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { WEEKDAYS } from "@/lib/constants";
import { saveSettings } from "@/lib/services/settings-service";
import { attendancePolicySchema, type AttendancePolicyValues } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

const FORM_ID = "attendance-policy-form";

export function AttendancePolicyForm() {
  const { db } = useAppData();
  const [save, saving] = useAction(saveSettings<"attendance">);

  const form = useForm<AttendancePolicyValues>({
    resolver: zodResolver(attendancePolicySchema),
    defaultValues: db.settings.attendance,
  });

  const submit = form.handleSubmit(async (values) => {
    const result = await save("attendance", values);
    if (!result.ok) {
      toast.error("Couldn't save settings", { description: result.error });
      return;
    }
    form.reset(values);
    toast.success("Attendance policy saved", {
      description: "Employees were notified. New check-outs use these rules straight away.",
    });
  });

  return (
    <SettingsSection
      title="Attendance policy"
      description="The rules that turn a check-in and check-out into a full day, a half day or an incomplete day."
      formId={FORM_ID}
      dirty={form.formState.isDirty}
      saving={saving}
      onDiscard={() => form.reset(db.settings.attendance)}
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <FieldGroup className="gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Controller
              name="officeStartTime"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="policy-start">Office start time</FieldLabel>
                  <Input {...field} id="policy-start" type="time" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="officeEndTime"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="policy-end">Office closing time</FieldLabel>
                  <Input {...field} id="policy-end" type="time" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <Controller
              name="requiredWorkingHours"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="policy-hours">Required working hours</FieldLabel>
                  <NumberInput
                    id="policy-hours"
                    min={1}
                    max={16}
                    step={0.5}
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
                    <FieldDescription>Hours for a full day.</FieldDescription>
                  )}
                </Field>
              )}
            />
            <Controller
              name="lateGraceMinutes"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="policy-grace">Late arrival grace</FieldLabel>
                  <NumberInput
                    id="policy-grace"
                    min={0}
                    max={120}
                    step={5}
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
                    <FieldDescription>Minutes after the start time.</FieldDescription>
                  )}
                </Field>
              )}
            />
            <Controller
              name="halfDayThresholdHours"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="policy-half">Half-day threshold</FieldLabel>
                  <NumberInput
                    id="policy-half"
                    min={0.5}
                    max={12}
                    step={0.5}
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
                    <FieldDescription>Minimum hours for a half day.</FieldDescription>
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            name="weeklyOffs"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Weekly offs</FieldLabel>
                <div role="group" aria-label="Weekly offs" className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const selected = field.value.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          field.onChange(
                            selected
                              ? field.value.filter((value) => value !== day.value)
                              : [...field.value, day.value].sort((a, b) => a - b),
                          )
                        }
                        className={cn(
                          "h-9 min-w-14 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          selected
                            ? "border-primary bg-accent text-accent-foreground"
                            : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {day.long}
                      </button>
                    );
                  })}
                </div>
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription>Selected days are days off. They are paid and never count as absences.</FieldDescription>
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </SettingsSection>
  );
}
