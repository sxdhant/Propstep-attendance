"use client";

import { BellOff, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { NotificationItem } from "@/components/layout/NotificationBell";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData } from "@/hooks/use-app-data";
import { pluralize } from "@/lib/format";
import { selectNotifications } from "@/lib/selectors/employee";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/services/notification-service";
import type { AppNotification } from "@/types/notification";

type Tab = "all" | "unread";

export function EmployeeNotificationsView() {
  const { db, employee, nowMs } = useAppData();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");

  const all = useMemo(() => selectNotifications(db, employee.id), [db, employee.id]);
  const unread = useMemo(() => all.filter((n) => !n.read), [all]);
  const visible = tab === "unread" ? unread : all;

  const open = (notification: AppNotification) => {
    void markNotificationRead(notification.id);
    if (notification.href) router.push(notification.href);
  };

  const markAll = async () => {
    const result = await markAllNotificationsRead(employee.id);
    if (result.ok) toast.success(`Marked ${pluralize(result.data.count, "notification")} as read`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Decisions on your attendance, payroll updates and announcements from your company."
        actions={
          <Button variant="outline" onClick={markAll} disabled={unread.length === 0}>
            <CheckCheck className="size-4" aria-hidden />
            Mark all as read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="gap-4">
        <TabsList>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
        </TabsList>

        {/* One panel serves whichever tab is active, so the selected tab always points at real content. */}
        <TabsContent value={tab}>
          <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
            {visible.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title={tab === "unread" ? "You're all caught up" : "No notifications yet"}
                description={
                  tab === "unread"
                    ? "New updates from your administrator will show up here."
                    : "When your attendance is reviewed or payroll changes, you'll be told here."
                }
              />
            ) : (
              <ul className="divide-y">
                {visible.map((notification) => (
                  <li key={notification.id}>
                    <NotificationItem notification={notification} nowMs={nowMs} onSelect={open} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
