import Image from "next/image";
import { cn } from "@/lib/utils";

/** The Propstep house mark, for tight spaces (mobile header, favicon-sized slots). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/propstep-mark.png"
      alt="Propstep"
      width={67}
      height={66}
      priority
      className={cn("size-9 shrink-0 object-contain", className)}
    />
  );
}

/**
 * The full Propstep logo (mark + wordmark).
 *  - `onLight` (default): dark lettering, for white or light surfaces.
 *  - `onDark`: white lettering, for the dark brand panel.
 */
export function Wordmark({ variant = "onLight", className }: { variant?: "onLight" | "onDark"; className?: string }) {
  return (
    <Image
      src={variant === "onDark" ? "/brand/propstep-logo-white.png" : "/brand/propstep-logo.png"}
      alt="Propstep"
      width={311}
      height={67}
      priority
      className={cn("h-8 w-auto shrink-0", className)}
    />
  );
}
