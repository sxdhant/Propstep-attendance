import type { Metadata } from "next";
import { AdminEmployeesView } from "@/components/admin/EmployeesView";

export const metadata: Metadata = { title: "Employees" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function AdminEmployeesPage() {
  return <AdminEmployeesView />;
}
