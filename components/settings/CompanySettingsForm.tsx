"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { LogoMark } from "@/components/layout/Logo";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { saveSettings } from "@/lib/services/settings-service";
import { companySettingsSchema, type CompanySettingsValues } from "@/lib/validation/schemas";

const FORM_ID = "company-settings-form";

export function CompanySettingsForm() {
  const { db } = useAppData();
  const [save, saving] = useAction(saveSettings<"company">);

  const form = useForm<CompanySettingsValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: db.settings.company,
  });

  const submit = form.handleSubmit(async (values) => {
    const result = await save("company", values);
    if (!result.ok) {
      toast.error("Couldn't save settings", { description: result.error });
      return;
    }
    form.reset(values);
    toast.success("Company settings saved", { description: "Saved. The change applies across the company." });
  });

  return (
    <SettingsSection
      title="Company"
      description="How your company appears across the app."
      formId={FORM_ID}
      dirty={form.formState.isDirty}
      saving={saving}
      onDiscard={() => form.reset(db.settings.company)}
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <FieldGroup className="gap-6">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="company-name">Company name</FieldLabel>
                <Input {...field} id="company-name" autoComplete="organization" aria-invalid={fieldState.invalid} />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription>Shown in the sidebar and on reports.</FieldDescription>
                )}
              </Field>
            )}
          />

          <Field>
            <FieldLabel>Company logo</FieldLabel>
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed p-4">
              <LogoMark className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Placeholder logo</p>
                <p className="text-xs text-muted-foreground">Uploading a logo needs file storage, which arrives with the backend.</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled>
                <ImageUp className="size-4" aria-hidden />
                Upload logo
              </Button>
            </div>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Controller
              name="timezone"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="company-timezone">Office timezone</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="company-timezone" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((zone) => (
                        <SelectItem key={zone.value} value={zone.value}>
                          {zone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>The company runs in India Standard Time. More zones will be added later.</FieldDescription>
                </Field>
              )}
            />

            <Controller
              name="currency"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="company-currency">Currency</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="company-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>Changes how amounts are formatted. Values are not converted.</FieldDescription>
                </Field>
              )}
            />
          </div>
        </FieldGroup>
      </form>
    </SettingsSection>
  );
}
