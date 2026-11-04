import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Clock,
  Lock,
  Megaphone,
  PartyPopper,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/status-config";
import type { NotificationType } from "@/types/notification";

export const NOTIFICATION_META: Record<NotificationType, { icon: LucideIcon; tone: Tone; label: string }> = {
  attendance_approved: { icon: CircleCheck, tone: "green", label: "Attendance" },
  attendance_rejected: { icon: CircleX, tone: "red", label: "Attendance" },
  attendance_submitted: { icon: Clock, tone: "orange", label: "Attendance" },
  attendance_reminder: { icon: TriangleAlert, tone: "yellow", label: "Attendance" },
  payroll_finalized: { icon: Lock, tone: "blue", label: "Payroll" },
  payroll_paid: { icon: BadgeCheck, tone: "green", label: "Payroll" },
  policy_update: { icon: Megaphone, tone: "blue", label: "Announcement" },
  holiday: { icon: PartyPopper, tone: "violet", label: "Holiday" },
};
