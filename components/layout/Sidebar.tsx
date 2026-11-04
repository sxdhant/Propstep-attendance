"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/layout/Logo";
import { useAppData } from "@/hooks/use-app-data";
import { NAV_ITEMS } from "@/lib/navigation";
import { mustCompleteProfile } from "@/lib/profile-utils";
import { selectPendingCount } from "@/lib/selectors/admin";
import { cn } from "@/lib/utils";

interface SidebarContentProps {
  /** Called after a link is chosen, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { role, db, recipientId, employee } = useAppData();
  const pathname = usePathname();

  // Until the profile is submitted, the profile is the only page that opens.
  const profileOnly = role === "employee" && mustCompleteProfile(employee);
  const items = profileOnly ? NAV_ITEMS.employee.filter((item) => item.href === "/employee/profile") : NAV_ITEMS[role];

  const unread = db.notifications.filter((n) => n.recipient === recipientId && !n.read).length;
  const pending = role === "admin" ? selectPendingCount(db) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b px-5">
        <Wordmark className="h-8" />
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">
          {role === "admin" ? "Administration" : "My workspace"}
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const count = item.badge === "unread" ? unread : item.badge === "pending" ? pending : 0;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                        item.badge === "pending"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      <span className="sr-only">{item.badge === "pending" ? "Pending: " : "Unread: "}</span>
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r bg-sidebar lg:block">
      <SidebarContent />
    </aside>
  );
}
