import type { Metadata } from "next";
import { AdminDashboardView } from "@/components/admin/DashboardView";

export const metadata: Metadata = { title: "Admin Dashboard" };

// This phase keeps all data in the browser, so the server can only render the loading shell.
// Opting out stops Next.js from flagging the page as "not instantly navigable" in development.
export const instant = false;

export default function AdminDashboardPage() {
  return <AdminDashboardView />;
}
