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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/50 bg-white/40 p-3.5 text-sm">
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
      <span className="login-orb login-orb-a" aria-hidden />
      <span className="login-orb login-orb-b" aria-hidden />
      <span className="login-orb login-orb-c" aria-hidden />

      <main id="main" className="relative z-10 grid min-h-dvh place-items-center px-4 py-10">
        <section className="liquid-glass w-full max-w-[26rem] p-7 sm:p-9" aria-labelledby="login-title">
          <div className="mb-6 flex justify-center">
            <Wordmark className="h-10" />
          </div>

          <SignedInNotice />

          <h1 id="login-title" className="text-center text-2xl font-semibold tracking-tight">
            Sign in to {APP_NAME}
          </h1>
          <p className="mt-1.5 mb-7 text-center text-sm text-muted-foreground">Use your work email to open your workspace.</p>

          <LoginForm />
        </section>
      </main>
    </div>
  );
}
