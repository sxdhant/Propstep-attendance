"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { requestPasswordReset } from "@/lib/services/session-service";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/schemas";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the field with whatever was typed into the login form. */
  defaultEmail?: string;
}

export function ForgotPasswordDialog({ open, onOpenChange, defaultEmail = "" }: ForgotPasswordDialogProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [run, pending] = useAction(requestPasswordReset);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });

  const submit = form.handleSubmit(async ({ email }) => {
    const result = await run(email);
    if (result.ok) setSentTo(result.data.email);
  });

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // Wait for the close animation before clearing, so the content doesn't flicker.
      setTimeout(() => {
        setSentTo(null);
        form.reset({ email: defaultEmail });
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {sentTo ? (
          <>
            <DialogHeader className="gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-green-50 text-green-700">
                <MailCheck className="size-5" aria-hidden />
              </span>
              <DialogTitle className="text-lg font-semibold">Check your inbox</DialogTitle>
              <DialogDescription>
                If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, a reset link
                is on its way. It works for 60 minutes and only once.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Back to sign in</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-5">
            <DialogHeader className="gap-1.5">
              <DialogTitle className="text-lg font-semibold">Reset your password</DialogTitle>
              <DialogDescription>
                Enter the email you sign in with and we&apos;ll send reset instructions.
              </DialogDescription>
            </DialogHeader>

            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="forgot-email">Work email</FieldLabel>
                  <Input
                    {...field}
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                Send reset link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
