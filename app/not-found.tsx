import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Compass className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">We can&apos;t find that page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be old or mistyped. Head back to the sign-in page and pick up from there.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    </main>
  );
}
