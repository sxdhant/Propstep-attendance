import type { Metadata } from "next";
import { AdminReportsView } from "@/components/admin/ReportsView";

export const metadata: Metadata = { title: "Reports" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function AdminReportsPage() {
  return <AdminReportsView />;
}
