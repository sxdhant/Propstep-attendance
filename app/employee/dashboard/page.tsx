import type { Metadata } from "next";
import { EmployeeDashboardView } from "@/components/employee/DashboardView";

export const metadata: Metadata = { title: "Dashboard" };

// This phase keeps all data in the browser, so the server can only render the loading shell.
// Opting out stops Next.js from flagging the page as "not instantly navigable" in development.
export const instant = false;

export default function EmployeeDashboardPage() {
  return <EmployeeDashboardView />;
}
