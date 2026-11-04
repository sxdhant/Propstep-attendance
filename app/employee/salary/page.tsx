import type { Metadata } from "next";
import { EmployeeSalaryView } from "@/components/employee/SalaryView";

export const metadata: Metadata = { title: "Salary" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function EmployeeSalaryPage() {
  return <EmployeeSalaryView />;
}
