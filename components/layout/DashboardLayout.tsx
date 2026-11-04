"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { FullPageLoading } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { AppDataProvider, useAppData } from "@/hooks/use-app-data";
import { useDataError, useSessionState } from "@/hooks/use-store";
import { dataStore } from "@/lib/data-store";
import { HOME_BY_ROLE } from "@/lib/constants";
import { mustCompleteProfile } from "@/lib/profile-utils";
import { sessionStore } from "@/lib/session-store";
import type { UserRole } from "@/types/common";

const PROFILE_PATH = "/employee/profile";

interface DashboardLayoutProps {
  /** Which dashboard this route group renders. */
  role: UserRole;
  children: ReactNode;
}

/**
 * Shared shell for both dashboards. Until the browser has read its stored
 * session and data it shows a loader, which is also what the server renders,
 * so hydration never disagrees with the HTML.
 *
 * Signed-out visitors are sent to the login page. The redirect is only a
 * convenience; every API call is authorized again on the server.
 */
export function DashboardLayout({ role, children }: DashboardLayoutProps) {
  const session = useSessionState();
  const router = useRouter();

  // Signed-out visitors go to sign-in; accounts with a temporary password go to change it;
  // and nobody sees the other role's dashboard (the server enforces this too).
  const destination =
    session === null
      ? "/login"
      : session && session.mustChangePassword
        ? "/change-password"
        : session && session.role !== role
          ? HOME_BY_ROLE[session.role]
          : null;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (session === undefined || destination || !session) {
    return <FullPageLoading label={destination ? "Taking you there" : undefined} />;
  }

  return (
    <AppDataProvider role={role} fallback={<DataLoading />}>
      <Shell>{children}</Shell>
    </AppDataProvider>
  );
}

/** Loader that turns into a retry prompt if the first data fetch fails. */
function DataLoading() {
  const error = useDataError();
  if (!error) return <FullPageLoading />;
  return (
    <div role="alert" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <p className="text-base font-semibold">We couldn&apos;t load your workspace</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" onClick={() => void dataStore.refresh()}>Try again</Button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { session, employee, role } = useAppData();
  const pathname = usePathname();
  const router = useRouter();

  // If the remembered employee no longer exists (for example after a data reset), adopt a valid one.
  useEffect(() => {
    if (session.employeeId !== employee.id) sessionStore.update({ employeeId: employee.id });
  }, [session.employeeId, employee.id]);

  // A new employee has to submit their profile before anything else opens.
  const mustFinishProfile = role === "employee" && mustCompleteProfile(employee);
  const blocked = mustFinishProfile && pathname !== PROFILE_PATH;
  useEffect(() => {
    if (blocked) router.replace(PROFILE_PATH);
  }, [blocked, router]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-h-dvh flex-col lg:pl-60">
        <Header />
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {blocked ? <FullPageLoading label="Opening your profile" /> : children}
        </main>
      </div>
    </div>
  );
}
