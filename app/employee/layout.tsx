import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function EmployeeLayout({ children }: LayoutProps<"/employee">) {
  return <DashboardLayout role="employee">{children}</DashboardLayout>;
}
