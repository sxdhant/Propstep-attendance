import type { Metadata } from "next";
import { AdminProfileView } from "@/components/admin/ProfileView";

export const metadata: Metadata = { title: "My profile" };

export const instant = false;

export default function AdminProfilePage() {
  return <AdminProfileView />;
}
