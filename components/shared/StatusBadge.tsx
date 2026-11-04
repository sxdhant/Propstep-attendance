import { TONES, type StatusMeta } from "@/lib/status-config";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  meta: StatusMeta;
  /** Overrides the label, e.g. "Pending Approval" for the same pending meta. */
  label?: string;
  showIcon?: boolean;
  className?: string;
}

/**
 * Every status is an icon plus a word on a tinted pill, so meaning never
 * depends on color alone.
 */
export function StatusBadge({ meta, label, showIcon = true, className }: StatusBadgeProps) {
  const tone = TONES[meta.tone];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tone.badge,
        className,
      )}
    >
      {showIcon && <Icon className={cn("size-3.5 shrink-0", tone.icon)} aria-hidden />}
      {label ?? meta.label}
    </span>
  );
}
