"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ChangePasswordForm } from "@/components/auth/PasswordForms";
import { FullPageLoading } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { useSessionState } from "@/hooks/use-store";
import { HOME_BY_ROLE } from "@/lib/constants";
import { reloadTo } from "@/lib/navigation";
import { signOut } from "@/lib/services/session-service";

/** Shown after signing in with a temporary password; nothing else in the app opens until it is changed. */
export function ChangePasswordPage() {
  const session = useSessionState();
  const router = useRouter();

  useEffect(() => {
    if (session === null) router.replace("/login");
  }, [session, router]);

  if (!session) return <FullPageLoading label="One moment" />;

  const forced = Boolean(session.mustChangePassword);
  return (
    <AuthPageShell
      title={forced ? "Choose a new password" : "Change your password"}
      description={forced ? "You signed in with a temporary password. Pick one that only you know to continue." : "Changing it signs you out on your other devices."}
    >
      <ChangePasswordForm submitLabel="Save and continue" onDone={() => router.replace(HOME_BY_ROLE[session.role])} />
      <Button
        type="button"
        variant="ghost"
        className="mt-3 w-full"
        onClick={async () => {
          await signOut();
          reloadTo("/login");
        }}
      >
        Sign out
      </Button>
    </AuthPageShell>
  );
}
