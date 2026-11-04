import type { Metadata } from "next";
import { AdminAttendanceView } from "@/components/admin/AttendanceView";

export const metadata: Metadata = { title: "Attendance Approvals" };

// All content comes from browser storage in this phase; see the dashboard page for details.
export const instant = false;

export default function AdminAttendancePage() {
  return <AdminAttendanceView />;
}
