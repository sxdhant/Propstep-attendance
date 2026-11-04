"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-red-50 text-red-700">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page hit an unexpected problem. Try again, and if it keeps happening, sign out and back in or contact
          your administrator.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
