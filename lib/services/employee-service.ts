import { call } from "@/lib/services/core";
import type { ServiceResult } from "@/types/common";
import type { AccountStatus, Employee, EmployeeInput } from "@/types/employee";

export type EmployeePatch = Partial<Omit<EmployeeInput, "id">>;

/** The server assigns the employee ID and returns a one-time temporary password. */
export interface CreatedEmployee {
  employee: Employee;
  temporaryPassword: string;
}

export async function addEmployee(input: Omit<EmployeeInput, "id"> & { id?: string }): Promise<ServiceResult<CreatedEmployee>> {
  return call("POST", "/api/employees", {
    id: input.id?.trim(),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    department: input.department,
    designation: input.designation,
    joiningDate: input.joiningDate,
    monthlyBasicSalary: input.monthlyBasicSalary,
  });
}

export async function updateEmployee(id: string, patch: EmployeePatch): Promise<ServiceResult<Employee>> {
  // The server refuses a joining date later than the employee's first attendance record.
  return call("PATCH", `/api/employees/${encodeURIComponent(id)}`, patch);
}

export function setEmployeeStatus(id: string, status: AccountStatus): Promise<ServiceResult<Employee>> {
  return updateEmployee(id, { status });
}

/** Issues a new one-time temporary password and signs the employee out everywhere. */
export function resetEmployeePassword(id: string): Promise<ServiceResult<{ temporaryPassword: string }>> {
  return call("POST", `/api/employees/${encodeURIComponent(id)}/reset-password`, undefined, { sync: false });
}
