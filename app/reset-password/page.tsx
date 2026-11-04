import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/auth/ResetPasswordPage";

// The reset token is in the URL, so keep it out of search engines and out of Referer headers.
export const metadata: Metadata = { title: "Reset password", robots: { index: false }, referrer: "no-referrer" };

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}
