"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppData } from "@/hooks/use-app-data";
import { formatRelativeTime } from "@/lib/format";
import { NOTIFICATION_META } from "@/lib/notification-meta";
import { selectNotifications } from "@/lib/selectors/employee";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/services/notification-service";
import { TONES } from "@/lib/status-config";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/notification";

export function NotificationItem({
  notification,
  nowMs,
  onSelect,
}: {
  notification: AppNotification;
  nowMs: number;
  onSelect: (notification: AppNotification) => void;
}) {
  const meta = NOTIFICATION_META[notification.type];
  const tone = TONES[meta.tone];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
        !notification.read && "bg-accent/40",
      )}
    >
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-inset", tone.badge)}>
        <Icon className={cn("size-4", tone.icon)} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{notification.title}</span>
          {!notification.read && (
            <>
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="sr-only">Unread</span>
            </>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
          {notification.message}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {formatRelativeTime(notification.createdAt, nowMs)}
        </span>
      </span>
    </button>
  );
}

export function NotificationBell() {
  const { db, role, recipientId, nowMs } = useAppData();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const notifications = useMemo(() => selectNotifications(db, recipientId), [db, recipientId]);
  const unread = notifications.filter((n) => !n.read).length;

  const select = (notification: AppNotification) => {
    void markNotificationRead(notification.id);
    setOpen(false);
    if (notification.href) router.push(notification.href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="size-[18px]" aria-hidden />
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[24rem] max-w-[calc(100vw-1.5rem)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary"
              onClick={() => void markAllNotificationsRead(recipientId)}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-[22rem] divide-y overflow-y-auto">
            {notifications.slice(0, 6).map((notification) => (
              <li key={notification.id}>
                <NotificationItem notification={notification} nowMs={nowMs} onSelect={select} />
              </li>
            ))}
          </ul>
        )}

        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
            {role === "employee" ? (
              <Link href="/employee/notifications">View all notifications</Link>
            ) : (
              <Link href="/admin/attendance">Open attendance approvals</Link>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
