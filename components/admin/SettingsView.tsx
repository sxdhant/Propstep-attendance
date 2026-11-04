"use client";

import { useState } from "react";
import { AttendancePolicyForm } from "@/components/settings/AttendancePolicyForm";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { SalaryPolicyForm } from "@/components/settings/SalaryPolicyForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SettingsTab = "company" | "attendance" | "salary";

export function AdminSettingsView() {
  const [tab, setTab] = useState<SettingsTab>("company");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Company details, attendance rules and the salary formula. Every calculation reads from here."
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as SettingsTab)} className="gap-6">
        <TabsList>
          <TabsTrigger value="company" className="px-4">
            Company
          </TabsTrigger>
          <TabsTrigger value="attendance" className="px-4">
            Attendance Policy
          </TabsTrigger>
          <TabsTrigger value="salary" className="px-4">
            Salary Policy
          </TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanySettingsForm />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendancePolicyForm />
        </TabsContent>
        <TabsContent value="salary">
          <SalaryPolicyForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
