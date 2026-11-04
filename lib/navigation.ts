import {
  Bell,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  LayoutDashboard,
  ReceiptIndianRupee,
  Settings,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/common";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which live counter to show beside the label. */
  badge?: "unread" | "pending";
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  employee: [
    { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employee/attendance", label: "My Attendance", icon: CalendarDays },
    { href: "/employee/salary", label: "Salary", icon: Wallet },
    { href: "/employee/profile", label: "My Profile", icon: UserRound },
    { href: "/employee/notifications", label: "Notifications", icon: Bell, badge: "unread" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/employees", label: "Employees", icon: Users },
    { href: "/admin/attendance", label: "Attendance", icon: ClipboardCheck, badge: "pending" },
    { href: "/admin/payroll", label: "Payroll", icon: ReceiptIndianRupee },
    { href: "/admin/reports", label: "Reports", icon: ChartColumn },
    { href: "/admin/profile", label: "My Profile", icon: UserRound },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
};

/**
 * A full page load, not a client-side transition. Cache Components keeps
 * recently visited routes mounted, so after signing out a normal navigation
 * would leave their state (and the login form's "signed in" state) behind.
 */
export function reloadTo(path: string) {
  window.location.assign(new URL(path, window.location.origin));
}

export const ROLE_LABEL: Record<UserRole, string> = {
  employee: "Employee",
  admin: "Admin",
};
