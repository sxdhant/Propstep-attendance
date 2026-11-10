import {
  BadgeCheck,
  CalendarOff,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  Contrast,
  FilePen,
  Lock,
  LogOut,
  Minus,
  PartyPopper,
  Radio,
  TriangleAlert,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type {
  ApprovalStatus,
  AttendanceStatus,
  ChartStatus,
  DayDisplayStatus,
} from "@/types/attendance";
import type { PayrollStatus } from "@/types/payroll";
import type { ProfileStatus } from "@/types/profile";

/**
 * Single source of truth for how every status looks and reads.
 * Badges, calendar cells, legends and charts all pull from here, so a status
 * can never be green in one place and orange in another.
 */

export type Tone =
  | "green"
  | "orange"
  | "red"
  | "yellow"
  | "slate"
  | "gray"
  | "violet"
  | "cyan"
  | "blue";

export interface ToneStyle {
  /** Pill badge: tinted fill, readable text, hairline ring. */
  badge: string;
  /** Icon color inside a badge or row. */
  icon: string;
  /** Solid swatch used by legends. */
  swatch: string;
  /** Calendar cell / tile surface. */
  surface: string;
  /** Hex used by charts. */
  chart: string;
}

export const TONES: Record<Tone, ToneStyle> = {
  green: {
    badge: "bg-green-50 text-green-800 ring-green-600/20",
    icon: "text-green-600",
    swatch: "bg-green-600",
    surface: "border-green-200 bg-green-50 text-green-900",
    chart: "#17a34a",
  },
  orange: {
    badge: "bg-orange-50 text-orange-800 ring-orange-600/25",
    icon: "text-orange-600",
    swatch: "bg-orange-500",
    surface: "border-orange-200 bg-orange-50 text-orange-900",
    chart: "#ee7d2a",
  },
  red: {
    badge: "bg-red-50 text-red-800 ring-red-600/20",
    icon: "text-red-600",
    swatch: "bg-red-600",
    surface: "border-red-200 bg-red-50 text-red-900",
    chart: "#d03b3b",
  },
  yellow: {
    badge: "bg-yellow-50 text-yellow-900 ring-yellow-600/30",
    icon: "text-yellow-600",
    swatch: "bg-yellow-500",
    surface: "border-yellow-300 bg-yellow-50 text-yellow-900",
    chart: "#d99a00",
  },
  slate: {
    badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
    icon: "text-slate-500",
    swatch: "bg-slate-400",
    surface: "border-slate-300 bg-slate-100 text-slate-800",
    chart: "#7b8794",
  },
  gray: {
    badge: "bg-gray-50 text-gray-600 ring-gray-400/30",
    icon: "text-gray-400",
    swatch: "bg-gray-300",
    surface: "border-gray-200 bg-gray-50 text-gray-500",
    chart: "#d0d5dd",
  },
  violet: {
    badge: "bg-violet-50 text-violet-800 ring-violet-600/20",
    icon: "text-violet-600",
    swatch: "bg-violet-500",
    surface: "border-violet-200 bg-violet-50 text-violet-900",
    chart: "#7a5af8",
  },
  cyan: {
    badge: "bg-cyan-50 text-cyan-800 ring-cyan-600/20",
    icon: "text-cyan-600",
    swatch: "bg-cyan-500",
    surface: "border-cyan-200 bg-cyan-50 text-cyan-900",
    chart: "#06aed4",
  },
  blue: {
    badge: "bg-blue-50 text-blue-800 ring-blue-600/20",
    icon: "text-blue-600",
    swatch: "bg-blue-600",
    surface: "border-blue-200 bg-blue-50 text-blue-900",
    chart: "#2a78d6",
  },
};

export interface StatusMeta {
  label: string;
  tone: Tone;
  icon: LucideIcon;
  description: string;
}

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, StatusMeta> = {
  present: {
    label: "Present",
    tone: "green",
    icon: CircleCheck,
    description: "Completed a full working day.",
  },
  half_day: {
    label: "Half Day",
    tone: "cyan",
    icon: Contrast,
    description: "Worked at least the half-day threshold but less than a full day.",
  },
  absent: {
    label: "Absent",
    tone: "slate",
    icon: UserX,
    description: "No attendance was recorded on a working day.",
  },
  incomplete: {
    label: "Incomplete",
    tone: "yellow",
    icon: TriangleAlert,
    description: "Checked in without a check-out, or worked fewer hours than the half-day threshold.",
  },
  in_progress: {
    label: "Checked In",
    tone: "blue",
    icon: Radio,
    description: "Checked in and still working.",
  },
  holiday: {
    label: "Holiday",
    tone: "violet",
    icon: PartyPopper,
    description: "Company holiday.",
  },
  weekly_off: {
    label: "Weekly Off",
    tone: "gray",
    icon: CalendarOff,
    description: "Scheduled weekly off.",
  },
  week_off: {
    label: "Week Off",
    tone: "gray",
    icon: CalendarOff,
    description: "A day off taken by this employee.",
  },
  comp_off: {
    label: "Comp-off",
    tone: "cyan",
    icon: CalendarOff,
    description: "A paid day off, taken against a holiday worked.",
  },
  not_checked_in: {
    label: "Not Checked In",
    tone: "gray",
    icon: CircleDashed,
    description: "No check-in has been recorded yet.",
  },
};

export const APPROVAL_STATUS_META: Record<ApprovalStatus, StatusMeta> = {
  pending: {
    label: "Pending",
    tone: "orange",
    icon: Clock,
    description: "Waiting for an administrator to approve or reject.",
  },
  approved: {
    label: "Approved",
    tone: "green",
    icon: CircleCheck,
    description: "Approved and counted towards payroll.",
  },
  rejected: {
    label: "Rejected",
    tone: "red",
    icon: CircleX,
    description: "Rejected and not counted towards payroll.",
  },
  not_required: {
    label: "Not required",
    tone: "gray",
    icon: Minus,
    description: "No approval is needed for this day.",
  },
};

/** The collapsed status shown in calendar cells and their legend. */
export const DAY_DISPLAY_META: Record<DayDisplayStatus, StatusMeta> = {
  approved: { ...APPROVAL_STATUS_META.approved },
  pending: { ...APPROVAL_STATUS_META.pending },
  rejected: { ...APPROVAL_STATUS_META.rejected },
  absent: { ...ATTENDANCE_STATUS_META.absent },
  incomplete: { ...ATTENDANCE_STATUS_META.incomplete },
  in_progress: { ...ATTENDANCE_STATUS_META.in_progress },
  holiday: { ...ATTENDANCE_STATUS_META.holiday },
  weekly_off: { ...ATTENDANCE_STATUS_META.weekly_off },
  comp_off: { ...ATTENDANCE_STATUS_META.comp_off },
  not_checked_in: { ...ATTENDANCE_STATUS_META.not_checked_in },
  upcoming: {
    label: "Upcoming",
    tone: "gray",
    icon: CircleDashed,
    description: "This day has not happened yet.",
  },
  inactive: {
    label: "Not employed",
    tone: "gray",
    icon: Minus,
    description: "Outside the employee's active period.",
  },
};

export const PAYROLL_STATUS_META: Record<PayrollStatus | "not_generated", StatusMeta> = {
  not_generated: {
    label: "Not Generated",
    tone: "gray",
    icon: CircleDashed,
    description: "Payroll has not been generated yet. Figures are live estimates.",
  },
  draft: {
    label: "Draft",
    tone: "slate",
    icon: FilePen,
    description: "Generated from current attendance. Figures change until finalized.",
  },
  finalized: {
    label: "Finalized",
    tone: "blue",
    icon: Lock,
    description: "Figures are locked and waiting for payment.",
  },
  paid: {
    label: "Paid",
    tone: "green",
    icon: BadgeCheck,
    description: "Salary has been marked as paid.",
  },
};

export const PROFILE_STATUS_META: Record<ProfileStatus, StatusMeta> = {
  complete: {
    label: "Profile complete",
    tone: "green",
    icon: CircleCheck,
    description: "Personal, education, work and bank details are submitted.",
  },
  in_progress: {
    label: "In progress",
    tone: "orange",
    icon: FilePen,
    description: "A draft is saved but has not been submitted.",
  },
  not_started: {
    label: "Not started",
    tone: "gray",
    icon: CircleDashed,
    description: "The employee has not opened the profile form yet.",
  },
};

export const ACCOUNT_STATUS_META: Record<"active" | "inactive", StatusMeta> = {
  active: {
    label: "Active",
    tone: "green",
    icon: CircleCheck,
    description: "Can check in and appears on payroll.",
  },
  inactive: {
    label: "Inactive",
    tone: "slate",
    icon: UserX,
    description: "Deactivated. History is kept but check-in is switched off.",
  },
};

/** What a record's check-in/check-out trail says, independent of any approval. */
export type ActivityState = "checked_in" | "checked_out" | "no_checkout";

export const ACTIVITY_META: Record<ActivityState, StatusMeta> = {
  checked_in: {
    label: "Checked In",
    tone: "blue",
    icon: Radio,
    description: "Checked in and still working.",
  },
  checked_out: {
    label: "Checked Out",
    tone: "slate",
    icon: LogOut,
    description: "Checked in and out.",
  },
  no_checkout: {
    label: "No Check-out",
    tone: "yellow",
    icon: TriangleAlert,
    description: "Checked in but never checked out.",
  },
};

/* ---------------------------------- charts --------------------------------- */

/**
 * Stack order for attendance-status charts. This order was run through the
 * dataviz palette validator: it is the only arrangement in which no two
 * neighbouring colors (green / orange / red / amber) collapse under
 * red-green colorblindness. Do not reorder without re-validating.
 */
export const CHART_STATUS_ORDER: ChartStatus[] = [
  "approved",
  "absent",
  "pending",
  "rejected",
  "incomplete",
];

export const CHART_STATUS_META: Record<ChartStatus, { label: string; color: string; description: string }> = {
  approved: { label: "Approved", color: TONES.green.chart, description: "Approved by an administrator" },
  absent: { label: "Absent", color: TONES.slate.chart, description: "No attendance recorded" },
  pending: { label: "Pending review", color: TONES.orange.chart, description: "Waiting for approval" },
  rejected: { label: "Rejected", color: TONES.red.chart, description: "Rejected by an administrator" },
  incomplete: { label: "Incomplete", color: TONES.yellow.chart, description: "Missing check-out or too few hours" },
};

export function toChartStatus(display: DayDisplayStatus): ChartStatus | null {
  switch (display) {
    case "approved":
      return "approved";
    case "pending":
    case "in_progress":
      return "pending";
    case "rejected":
      return "rejected";
    case "incomplete":
      return "incomplete";
    case "absent":
      return "absent";
    default:
      return null;
  }
}

/** Payroll progress is ordered (draft → finalized → paid), so it takes a one-hue ramp. */
export const PAYROLL_CHART_COLORS = {
  not_generated: "#d0d5dd",
  draft: "#86b6ef",
  finalized: "#3987e5",
  paid: "#1c5cab",
} as const;

export const CHART_THEME = {
  accent: "#2a78d6",
  grid: "#e4e7ec",
  axis: "#d0d5dd",
  tick: "#667085",
  ink: "#1d2939",
  surface: "#ffffff",
  cursor: "rgba(16, 24, 40, 0.04)",
} as const;
