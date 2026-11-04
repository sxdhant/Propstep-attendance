import type { Metadata } from "next";
import { EmployeeNotificationsView } from "@/components/employee/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function EmployeeNotificationsPage() {
  return <EmployeeNotificationsView />;
}
