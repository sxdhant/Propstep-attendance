import type { Metadata } from "next";
import { EmployeeProfileView } from "@/components/employee/ProfileView";

export const metadata: Metadata = { title: "My Profile" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function EmployeeProfilePage() {
  return <EmployeeProfileView />;
}
