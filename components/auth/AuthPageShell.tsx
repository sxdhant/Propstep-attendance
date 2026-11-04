import { Wordmark } from "@/components/layout/Logo";

/** Centered card used by the standalone account pages (change password, reset password). */
export function AuthPageShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Wordmark className="h-9" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 mb-6 text-sm text-muted-foreground">{description}</p>
        <div className="rounded-2xl bg-card p-6 shadow-xs ring-1 ring-foreground/10 sm:p-7">{children}</div>
      </div>
    </main>
  );
}
