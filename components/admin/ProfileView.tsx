"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { SecurityDialog } from "@/components/auth/SecurityDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { useSessionState } from "@/hooks/use-store";
import { saveAdminProfile } from "@/lib/services/admin-service";
import { adminProfileSchema, type AdminProfileValues } from "@/lib/validation/schemas";

const FORM_ID = "admin-profile-form";

export function AdminProfileView() {
  const { admin, db } = useAppData();
  const session = useSessionState();
  const [securityOpen, setSecurityOpen] = useState(false);
  const [save, saving] = useAction(saveAdminProfile);

  const saved: AdminProfileValues = { fullName: admin.fullName, title: admin.title, phone: admin.phone ?? "" };
  const form = useForm<AdminProfileValues>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: saved,
  });

  const typedName = useWatch({ control: form.control, name: "fullName" });

  const submit = form.handleSubmit(async (values) => {
    const result = await save(values);
    if (!result.ok) {
      toast.error("Couldn't save your profile", { description: result.error });
      return;
    }
    form.reset({ fullName: result.data.fullName, title: result.data.title, phone: result.data.phone ?? "" });
    toast.success("Profile saved", { description: "Your name and title are updated across the app." });
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" description="Your details as the administrator of this workspace." />

      <section className="flex max-w-3xl flex-col gap-4 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10 sm:flex-row sm:items-center">
        <UserAvatar name={typedName || admin.fullName || admin.email} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{admin.fullName}</p>
          <p className="text-sm text-muted-foreground">{admin.title}</p>
          <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button type="button" variant="outline" onClick={() => setSecurityOpen(true)}>
            {session?.totpEnabled ? <ShieldCheck className="size-4" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
            Password &amp; security
          </Button>
        </div>
      </section>

      <SettingsSection
        title="Personal details"
        description="Shown to your team in notifications and in the profile menu."
        formId={FORM_ID}
        dirty={form.formState.isDirty}
        saving={saving}
        onDiscard={() => form.reset(saved)}
      >
        <form id={FORM_ID} onSubmit={submit} noValidate>
          <FieldGroup className="gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <Controller
                name="fullName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="admin-name">Full name</FieldLabel>
                    <Input {...field} id="admin-name" autoComplete="name" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="admin-title">Job title</FieldLabel>
                    <Input {...field} id="admin-title" autoComplete="organization-title" placeholder="For example, HR Manager" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="admin-phone">Phone (optional)</FieldLabel>
                  <Input {...field} id="admin-phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" aria-invalid={fieldState.invalid} className="sm:max-w-xs" />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="admin-email">Sign-in email</FieldLabel>
                <Input id="admin-email" value={admin.email} readOnly className="bg-muted/50" />
                <FieldDescription>Your email is your login, so it can&apos;t be edited here.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-company">Company</FieldLabel>
                <Input id="admin-company" value={db.settings.company.name} readOnly className="bg-muted/50" />
                <FieldDescription>Change the company name under Settings.</FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </form>
      </SettingsSection>

      <SecurityDialog open={securityOpen} onOpenChange={setSecurityOpen} />
    </div>
  );
}
