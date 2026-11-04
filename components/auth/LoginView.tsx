"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { Wordmark } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { useSessionState } from "@/hooks/use-store";
import { APP_NAME, HOME_BY_ROLE } from "@/lib/constants";
import { reloadTo } from "@/lib/navigation";
import { signOut } from "@/lib/services/session-service";

function SignedInNotice() {
  const router = useRouter();
  const session = useSessionState();
  if (!session) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3.5 text-sm">
      <p className="text-muted-foreground">
        You&apos;re already signed in as <span className="font-medium text-foreground">{session.email ?? session.role}</span>.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => router.push(session.mustChangePassword ? "/change-password" : HOME_BY_ROLE[session.role])}>
          Continue
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await signOut();
            reloadTo("/login");
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function LoginView() {
  return (
    <div className="login-stage">
      <main id="main" className="grid min-h-dvh place-items-center px-4 py-12">
        <section className="login-card w-full max-w-[25rem] px-7 py-9 sm:px-10 sm:py-11" aria-labelledby="login-title">
          <div className="mb-9 flex justify-center">
            <Wordmark className="h-9" />
          </div>

          <SignedInNotice />

          <h1 id="login-title" className="text-center text-[1.4rem] leading-tight">
            Sign in
          </h1>
          <p className="mt-2 mb-8 text-center text-sm text-muted-foreground">Use your work email to open {APP_NAME}.</p>

          <LoginForm />
        </section>
      </main>
    </div>
  );
}
