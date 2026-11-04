"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";
import { Button } from "@/components/ui/button";

export function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthPageShell title="Reset link is missing" description="Open the link from your email again, or request a new one from the sign-in page.">
        <div className="flex items-start gap-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 text-destructive" aria-hidden />
          <p>This page needs the reset link we emailed you.</p>
        </div>
        <Button asChild className="mt-5 w-full"><Link href="/login">Back to sign in</Link></Button>
      </AuthPageShell>
    );
  }

  if (done) {
    return (
      <AuthPageShell title="Password updated" description="You were signed out everywhere. Sign in with your new password.">
        <div className="flex items-start gap-3 text-sm">
          <CircleCheck className="mt-0.5 size-4 text-green-700" aria-hidden />
          <p>Your password was changed.</p>
        </div>
        <Button asChild className="mt-5 w-full"><Link href="/login">Go to sign in</Link></Button>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title="Set a new password" description="Choose a password you don't use anywhere else.">
      <ResetPasswordForm token={token} onDone={() => setDone(true)} />
    </AuthPageShell>
  );
}
