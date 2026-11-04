"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, Eye, EyeOff, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { Spinner } from "@/components/shared/LoadingState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { HOME_BY_ROLE, STORAGE_KEYS } from "@/lib/constants";
import { signInWithCredentials, verifyTotpSignIn } from "@/lib/services/session-service";
import { loginSchema, type LoginValues } from "@/lib/validation/schemas";
import type { Session } from "@/types/common";

type Banner = { kind: "error" | "success"; message: string } | null;

function readRememberedEmail(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.rememberedEmail) ?? "";
  } catch {
    return "";
  }
}

function writeRememberedEmail(email: string | null) {
  try {
    if (email) window.localStorage.setItem(STORAGE_KEYS.rememberedEmail, email);
    else window.localStorage.removeItem(STORAGE_KEYS.rememberedEmail);
  } catch {
    // Storage unavailable: "remember my email" simply won't pre-fill next time.
  }
}

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [signIn, signingIn] = useAction(signInWithCredentials);
  const [verify, verifying] = useAction(verifyTotpSignIn);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { email: "", password: "", remember: false },
  });

  // Pre-fill the email the visitor asked us to remember. Browser storage is only read on the client.
  useEffect(() => {
    const saved = readRememberedEmail();
    if (saved) {
      form.setValue("email", saved);
      form.setValue("remember", true);
    }
  }, [form]);

  const enter = (session: Session) => {
    form.resetField("password"); // never leave a typed password sitting in a mounted screen
    setBanner({ kind: "success", message: "Signed in. Taking you to your dashboard." });
    router.push(session.mustChangePassword ? "/change-password" : HOME_BY_ROLE[session.role]);
  };

  const submit = form.handleSubmit(async (values) => {
    setBanner(null);
    const result = await signIn(values);
    if (!result.ok) {
      setBanner({ kind: "error", message: result.error });
      return;
    }
    writeRememberedEmail(values.remember ? values.email.trim() : null);
    if (result.data.requiresTotp) {
      setChallenge(result.data.challenge);
      return;
    }
    enter(result.data.session);
  });

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    setBanner(null);
    const result = await verify(challenge, code);
    if (!result.ok) {
      setBanner({ kind: "error", message: result.error });
      setCode("");
      return;
    }
    enter(result.data);
  };

  const done = banner?.kind === "success";
  const alert = banner && (
    <Alert
      variant={banner.kind === "error" ? "destructive" : "default"}
      className={banner.kind === "success" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50"}
    >
      {banner.kind === "error" ? <TriangleAlert aria-hidden /> : <CircleCheck aria-hidden />}
      <AlertDescription className={banner.kind === "success" ? "text-green-900/90" : undefined}>{banner.message}</AlertDescription>
    </Alert>
  );

  if (challenge) {
    return (
      <form onSubmit={submitCode} noValidate className="grid gap-5" aria-label="Two-factor verification">
        {alert}
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Two-factor verification</p>
            <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
          </div>
        </div>
        <Field>
          <FieldLabel htmlFor="login-code">Verification code</FieldLabel>
          <Input
            id="login-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={24}
            placeholder="123456"
            disabled={verifying || done}
            className="h-10 tracking-widest"
          />
          <FieldDescription>Lost your phone? Use a recovery code instead.</FieldDescription>
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={verifying || done || code.trim().length < 6}>
          {verifying && <Spinner />}
          {done ? "Signed in" : verifying ? "Verifying" : "Verify and sign in"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setChallenge(null); setCode(""); setBanner(null); }} disabled={verifying || done}>
          Back to sign in
        </Button>
      </form>
    );
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="grid gap-5" aria-label="Sign in">
        {alert}

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">Work email</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="name@company.com"
                aria-invalid={fieldState.invalid}
                disabled={signingIn || done}
                className="h-10"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="rounded text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  {...field}
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={fieldState.invalid}
                  disabled={signingIn || done}
                  className="h-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="remember"
          control={form.control}
          render={({ field }) => (
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="login-remember"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={signingIn || done}
              />
              <label htmlFor="login-remember" className="cursor-pointer text-sm text-foreground select-none">
                Remember my email on this device
              </label>
            </div>
          )}
        />

        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={signingIn || done}>
          {signingIn && <Spinner />}
          {done ? "Signed in" : signingIn ? "Signing in" : "Sign In"}
        </Button>
      </form>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={form.getValues("email")} />
    </>
  );
}
