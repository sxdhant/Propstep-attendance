import type { Metadata } from "next";
import { AdminSettingsView } from "@/components/admin/SettingsView";

export const metadata: Metadata = { title: "Settings" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function AdminSettingsPage() {
  return <AdminSettingsView />;
}
