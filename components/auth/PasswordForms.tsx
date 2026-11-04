"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { changePassword, resetPassword } from "@/lib/services/session-service";

/** Rules the server enforces, shown up front so people aren't surprised. */
export const PASSWORD_HINT =
  "At least 10 characters, not a common password, and a mix of three of: lowercase, uppercase, numbers, symbols (or 16+ characters).";

function PasswordInput({ id, label, value, onChange, autoComplete, hint, error }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: string;
  error?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className="h-10 pr-11"
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {error ? <FieldError errors={[{ message: error }]} /> : hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

/** Change the signed-in user's password. Used by the forced first-login page and the Security dialog. */
export function ChangePasswordForm({ onDone, submitLabel = "Change password" }: { onDone: () => void; submitLabel?: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<{ field: "current" | "next" | "confirm" | "form"; message: string } | null>(null);
  const [run, pending] = useAction(changePassword);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!current) return setError({ field: "current", message: "Enter your current password." });
    if (next !== confirm) return setError({ field: "confirm", message: "The two new passwords don't match." });
    const result = await run(current, next);
    if (!result.ok) {
      const field = /current/i.test(result.error) ? "current" : "next";
      return setError({ field, message: result.error });
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <PasswordInput id="pw-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" error={error?.field === "current" ? error.message : undefined} />
      <PasswordInput id="pw-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" hint={PASSWORD_HINT} error={error?.field === "next" ? error.message : undefined} />
      <PasswordInput id="pw-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={error?.field === "confirm" ? error.message : undefined} />
      <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">
        {pending && <Spinner />}
        {submitLabel}
      </Button>
    </form>
  );
}

/** Choose a new password from an emailed reset link. */
export function ResetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [run, pending] = useAction(resetPassword);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (next !== confirm) return setError("The two passwords don't match.");
    const result = await run(token, next);
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <PasswordInput id="reset-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" hint={PASSWORD_HINT} error={error && !/match/.test(error) ? error : undefined} />
      <PasswordInput id="reset-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={error && /match/.test(error) ? error : undefined} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner />}
        Set new password
      </Button>
    </form>
  );
}
