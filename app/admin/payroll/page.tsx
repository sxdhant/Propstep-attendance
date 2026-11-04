import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin/PayrollView";

export const metadata: Metadata = { title: "Payroll" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function AdminPayrollPage() {
  return <AdminPayrollView />;
}
