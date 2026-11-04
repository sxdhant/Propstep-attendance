import { useState } from "react";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

// Cool, low-saturation tints only: warm greens/oranges/reds are reserved for status colors.
const TINTS = [
  "bg-blue-100 text-blue-800",
  "bg-indigo-100 text-indigo-800",
  "bg-sky-100 text-sky-800",
  "bg-slate-200 text-slate-700",
  "bg-zinc-200 text-zinc-700",
  "bg-stone-200 text-stone-700",
] as const;

function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

const SIZES = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
  xl: "size-16 text-xl",
} as const;

interface UserAvatarProps {
  name: string;
  /** Profile photo URL. Initials show when there is none or it fails to load. */
  photo?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Initials are drawn with CSS generated content rather than text. The avatar
 * is decorative (the person's name always sits beside it), and this keeps the
 * letters out of the surrounding button's text, so a button's accessible name
 * can match what it visibly says.
 */
export function UserAvatar({ name, photo, size = "md", className }: UserAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  if (photo && failed !== photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small, authenticated, already-resized photo
      <img
        src={photo}
        alt=""
        aria-hidden
        onError={() => setFailed(photo)}
        className={cn("inline-block shrink-0 rounded-full bg-muted object-cover select-none", SIZES[size].split(" ")[0], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      data-initials={getInitials(name)}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold select-none before:content-[attr(data-initials)]",
        SIZES[size],
        tintFor(name),
        className,
      )}
    />
  );
}
