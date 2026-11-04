import { ChevronDown, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { TONES, type Tone } from "@/lib/status-config";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** One line of context under the value. */
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  /** Turns the whole card into a link. */
  href?: string;
  /**
   * Turns the whole card into an expand/collapse button. `expanded` says whether
   * the panel it controls is open, and `controls` is that panel's element id.
   */
  onToggle?: () => void;
  expanded?: boolean;
  controls?: string;
  /** Short call to action shown on expandable cards, e.g. "names". */
  toggleLabel?: string;
  className?: string;
}

/**
 * Label, value, context: nothing else. Large values use proportional
 * figures, which read better at display size than tabular ones.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  href,
  onToggle,
  expanded = false,
  controls,
  toggleLabel = "details",
  className,
}: StatCardProps) {
  const toneStyle = TONES[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-medium text-muted-foreground">{label}</p>
        <span
          className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset", toneStyle.badge)}
        >
          <Icon className={cn("size-4", toneStyle.icon)} aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-[1.625rem] leading-8 font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {onToggle && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          {expanded ? "Hide" : "Show"} {toggleLabel}
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </p>
      )}
    </>
  );

  const base =
    "block w-full rounded-xl bg-card p-4 text-left shadow-xs ring-1 ring-foreground/10 transition-shadow sm:p-5";
  const interactive = "hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none";

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={controls}
        className={cn(base, interactive, "cursor-pointer", expanded && "ring-2 ring-primary/60", className)}
      >
        {body}
      </button>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cn(base, interactive, className)}>
        {body}
      </Link>
    );
  }
  return <div className={cn(base, className)}>{body}</div>;
}
