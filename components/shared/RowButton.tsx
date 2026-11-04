import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RowButtonProps {
  children: ReactNode;
  /** Spoken after the visible text, e.g. "view details". Hidden on screen. */
  hint: string;
  onClick: () => void;
  className?: string;
}

/**
 * The keyboard and screen-reader entry point for a clickable table row.
 * The row itself stays a plain `<tr>` (so table semantics are intact) and may
 * also carry an `onClick` for pointer users; this button is what gets focus.
 * Its accessible name begins with the visible text, as voice control expects.
 */
export function RowButton({ children, hint, onClick, className }: RowButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        // The row handles clicks too; don't open the same panel twice.
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-sm text-left hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        className,
      )}
    >
      {children}
      <span className="sr-only">, {hint}</span>
    </button>
  );
}
