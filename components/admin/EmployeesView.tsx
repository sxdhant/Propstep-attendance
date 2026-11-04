"use client";

import { Power, PowerOff, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmployeeCardList } from "@/components/employees/EmployeeCardList";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { EmployeeProfileDialog } from "@/components/employees/EmployeeProfileDialog";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterSelect, SearchFilters, SearchInput } from "@/components/shared/SearchFilters";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { usePagination } from "@/hooks/use-pagination";
import { DEPARTMENTS } from "@/lib/constants";
import { pluralize } from "@/lib/format";
import { setEmployeeStatus } from "@/lib/services/employee-service";
import type { Employee } from "@/types/employee";

const PAGE_SIZE = 8;

type StatusFilter = "all" | "active" | "inactive";

export function AdminEmployeesView() {
  const { db } = useAppData();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Dialog targets are remembered by id so they always show the latest data (and survive the close animation).
  const [formOpen, setFormOpen] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggleId, setToggleId] = useState<string | null>(null);

  const [runToggle, toggling] = useAction(setEmployeeStatus);

  const departments = useMemo(
    () => [...new Set<string>([...DEPARTMENTS, ...db.employees.map((e) => e.department)])].sort(),
    [db.employees],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.employees
      .filter(
        (e) =>
          (!query || e.fullName.toLowerCase().includes(query) || e.id.toLowerCase().includes(query)) &&
          (department === "all" || e.department === department) &&
          (status === "all" || e.status === status),
      )
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [db.employees, search, department, status]);

  const pagination = usePagination(rows, PAGE_SIZE);

  const byId = (id: string | null): Employee | null => db.employees.find((e) => e.id === id) ?? null;
  const formEmployee = byId(formEmployeeId);
  const profileEmployee = byId(profileId);
  const toggleEmployee = byId(toggleId);

  const filtersActive = search.trim() !== "" || department !== "all" || status !== "all";
  const activeCount = db.employees.filter((e) => e.status === "active").length;

  const openForm = (employee: Employee | null) => {
    setFormEmployeeId(employee?.id ?? null);
    setFormOpen(true);
  };
  const openProfile = (employee: Employee) => {
    setProfileId(employee.id);
    setProfileOpen(true);
  };
  const askToggle = (employee: Employee) => {
    setToggleId(employee.id);
    setToggleOpen(true);
  };
  const clearFilters = () => {
    setSearch("");
    setDepartment("all");
    setStatus("all");
    pagination.setPage(1);
  };

  const confirmToggle = async () => {
    if (!toggleEmployee) return;
    const nextStatus = toggleEmployee.status === "active" ? "inactive" : "active";
    const result = await runToggle(toggleEmployee.id, nextStatus);
    if (!result.ok) {
      toast.error("Couldn't update the account", { description: result.error });
      return;
    }
    toast.success(nextStatus === "inactive" ? "Employee deactivated" : "Employee reactivated", {
      description:
        nextStatus === "inactive"
          ? `${toggleEmployee.fullName} can no longer check in. Their history is kept.`
          : `${toggleEmployee.fullName} can check in again.`,
    });
    setToggleOpen(false);
  };

  const deactivating = toggleEmployee?.status === "active";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={`${pluralize(db.employees.length, "employee")}, ${activeCount} active. Changes appear on every dashboard straight away.`}
        actions={
          <Button onClick={() => openForm(null)}>
            <UserPlus className="size-4" aria-hidden />
            Add Employee
          </Button>
        }
      />

      <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <header className="p-5">
          <SearchFilters active={filtersActive} onClear={clearFilters}>
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                pagination.setPage(1);
              }}
              placeholder="Search by name or employee ID"
              className="w-full sm:w-80"
            />
            <FilterSelect
              ariaLabel="Filter by department"
              value={department}
              onValueChange={(value) => {
                setDepartment(value);
                pagination.setPage(1);
              }}
              options={[
                { value: "all", label: "All departments" },
                ...departments.map((d) => ({ value: d, label: d })),
              ]}
            />
            <FilterSelect
              ariaLabel="Filter by account status"
              value={status}
              onValueChange={(value) => {
                setStatus(value as StatusFilter);
                pagination.setPage(1);
              }}
              options={[
                { value: "all", label: "All accounts" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </SearchFilters>
        </header>

        {rows.length === 0 ? (
          <div className="border-t">
            <EmptyState
              icon={Users}
              title="No employees match these filters"
              description="Try a different name, department or account status, or add a new employee."
              action={
                <div className="flex gap-2">
                  {filtersActive && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                  <Button size="sm" onClick={() => openForm(null)}>
                    <UserPlus className="size-4" aria-hidden />
                    Add Employee
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <>
            <div className="border-t">
              {/* A dense table from tablet width up, one card per person on phones. */}
              <div className="hidden md:block">
                <EmployeeTable
                  employees={pagination.pageItems}
                  onView={openProfile}
                  onEdit={openForm}
                  onToggleStatus={askToggle}
                />
              </div>
              <div className="md:hidden">
                <EmployeeCardList
                  employees={pagination.pageItems}
                  onView={openProfile}
                  onEdit={openForm}
                  onToggleStatus={askToggle}
                />
              </div>
            </div>
            <DataTablePagination pagination={pagination} noun="employees" />
          </>
        )}
      </section>

      <EmployeeForm open={formOpen} onOpenChange={setFormOpen} employee={formEmployee} />
      <EmployeeProfileDialog
        employee={profileEmployee}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onEdit={openForm}
      />
      <ConfirmDialog
        open={toggleOpen}
        onOpenChange={setToggleOpen}
        title={deactivating ? "Deactivate this employee?" : "Reactivate this employee?"}
        description={
          deactivating
            ? `${toggleEmployee?.fullName} will no longer be able to check in. Their attendance history and past payroll are kept.`
            : `${toggleEmployee?.fullName} will be able to check in again and will appear on future payroll.`
        }
        icon={deactivating ? PowerOff : Power}
        tone={deactivating ? "destructive" : "success"}
        confirmLabel={deactivating ? "Deactivate" : "Reactivate"}
        pending={toggling}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
