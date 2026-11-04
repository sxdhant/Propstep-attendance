import type { Metadata } from "next";
import { EmployeeAttendanceView } from "@/components/employee/AttendanceView";

export const metadata: Metadata = { title: "My Attendance" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function EmployeeAttendancePage() {
  return <EmployeeAttendanceView />;
}
