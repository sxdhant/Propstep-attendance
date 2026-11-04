import { LoaderCircle } from "lucide-react";
import { LogoMark } from "@/components/layout/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("size-4 animate-spin", className)} aria-hidden />;
}

/** Inline loading message for a section that is waiting on something. */
export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground", className)}
    >
      <Spinner />
      {label}
    </div>
  );
}

/**
 * What server rendering and the hydration pass show. Real data is read from
 * the browser right after, so the page never renders content that differs
 * between server and client.
 */
export function FullPageLoading({ label = "Loading your workspace" }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-11 animate-pulse" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Placeholder layout for a dashboard page while its data is on the way. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
