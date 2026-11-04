"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { Wordmark } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { useSessionState } from "@/hooks/use-store";
import { APP_NAME, DEFAULT_SETTINGS, HOME_BY_ROLE } from "@/lib/constants";
import { formatCurrency, formatUnits } from "@/lib/format";
import { reloadTo } from "@/lib/navigation";
import { calculateSalary, SALARY_EXAMPLE } from "@/lib/salary-calculator";
import { signOut } from "@/lib/services/session-service";

/** A line of the sample ledger: label, dotted leader, value. */
function LedgerLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 text-sm ${strong ? "font-semibold text-white" : "text-white/70"}`}>
      <span>{label}</span>
      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-white/20" aria-hidden />
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** The brand panel shows the product's whole idea in one object: a salary with its working. */
function BrandPanel() {
  const example = calculateSalary(SALARY_EXAMPLE, DEFAULT_SETTINGS.salary);

  return (
    <aside className="relative hidden flex-col justify-between bg-ink p-12 text-ink-foreground lg:flex xl:p-16">
      <div className="flex items-center gap-3">
        <Wordmark variant="onDark" className="h-10" />
      </div>

      <div className="max-w-lg">
        <p className="text-4xl leading-[1.15] font-semibold tracking-tight text-balance xl:text-[2.75rem]">
          Attendance you can approve. Salary you can explain.
        </p>
        <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
          Employees check in, administrators review each day, and payroll shows its working line by line.
        </p>

        <div className="mt-10 rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10 ring-inset">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-white/90">Sample salary</p>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">Illustration</span>
          </div>
          <div className="space-y-2.5">
            <LedgerLine label="Monthly basic salary" value={formatCurrency(SALARY_EXAMPLE.monthlyBasicSalary)} />
            <LedgerLine label="Approved full days" value={String(SALARY_EXAMPLE.approvedFullDays)} />
            <LedgerLine label="Approved half days × 0.5" value={formatUnits(SALARY_EXAMPLE.approvedHalfDays * 0.5)} />
            <LedgerLine label="Payable units" value={formatUnits(example.payableUnits)} />
            <LedgerLine label="Scheduled working days" value={String(SALARY_EXAMPLE.scheduledWorkingDays)} />
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <LedgerLine label="Estimated salary" value={formatCurrency(example.estimatedSalary)} strong />
          </div>
        </div>
      </div>

      <p className="text-sm text-white/50">Secure sign-in. Your session is protected and every sign-in is logged.</p>
    </aside>
  );
}

function SignedInNotice() {
  const router = useRouter();
  const session = useSessionState();
  if (!session) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3.5 text-sm">
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
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />

      <main id="main" className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Wordmark className="h-9" />
          </div>

          <SignedInNotice />

          <h1 className="text-2xl font-semibold tracking-tight">Sign in to {APP_NAME}</h1>
          <p className="mt-1.5 mb-7 text-sm text-muted-foreground">Use your work email to open your workspace.</p>

          <div className="rounded-2xl bg-card p-6 shadow-xs ring-1 ring-foreground/10 sm:p-7">
            <LoginForm />
          </div>

        </div>
      </main>
    </div>
  );
}
