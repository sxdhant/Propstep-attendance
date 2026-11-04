import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <DashboardLayout role="admin">{children}</DashboardLayout>;
}
