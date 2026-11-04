"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Spinner } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { DEPARTMENTS } from "@/lib/constants";
import { addEmployee, updateEmployee } from "@/lib/services/employee-service";
import { createEmployeeSchema, type EmployeeFormValues } from "@/lib/validation/schemas";
import type { Employee } from "@/types/employee";

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` means "add a new employee". */
  employee: Employee | null;
}

function EmployeeFormBody({ employee, onDone }: { employee: Employee | null; onDone: () => void }) {
  const { db, today } = useAppData();
  const editing = employee !== null;

  const schema = useMemo(() => createEmployeeSchema(db.employees, employee?.id), [db.employees, employee?.id]);
  const departments = useMemo(
    () => [...new Set<string>([...DEPARTMENTS, ...db.employees.map((e) => e.department)])],
    [db.employees],
  );

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: employee
      ? {
          fullName: employee.fullName,
          id: employee.id,
          email: employee.email,
          phone: employee.phone,
          department: employee.department,
          designation: employee.designation,
          joiningDate: employee.joiningDate,
          monthlyBasicSalary: employee.monthlyBasicSalary,
          status: employee.status,
        }
      : {
          fullName: "",
          id: "",
          email: "",
          phone: "",
          department: "",
          designation: "",
          joiningDate: today,
          monthlyBasicSalary: NaN,
          status: "active",
        },
  });

  const [save, saving] = useAction(async (values: EmployeeFormValues) => {
    if (!employee) return addEmployee(values);
    // The ID is the record's key, so it is never part of an update.
    return updateEmployee(employee.id, {
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      department: values.department,
      designation: values.designation,
      joiningDate: values.joiningDate,
      monthlyBasicSalary: values.monthlyBasicSalary,
      status: values.status,
    });
  });

  const submit = form.handleSubmit(async (values) => {
    const result = await save(values);
    if (!result.ok) {
      toast.error(editing ? "Couldn't save changes" : "Couldn't add the employee", { description: result.error });
      return;
    }
    if ("temporaryPassword" in result.data) {
      const { employee: created, temporaryPassword } = result.data;
      toast.success(`${created.fullName} was added as ${created.id}`, {
        description: `Temporary password: ${temporaryPassword}. Share it securely. It is shown only once, and they must choose a new one at first sign-in.`,
        duration: Infinity,
        closeButton: true,
        action: {
          label: "Copy",
          onClick: () => void navigator.clipboard?.writeText(temporaryPassword),
        },
      });
    } else {
      toast.success("Employee updated", { description: `${result.data.fullName}'s details are saved everywhere.` });
    }
    onDone();
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <FieldGroup className="gap-5">
          <Controller
            name="fullName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="emp-name">Full name</FieldLabel>
                <Input {...field} id="emp-name" autoComplete="off" placeholder="For example, Isha Malhotra" aria-invalid={fieldState.invalid} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              name="id"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="emp-id">Employee ID</FieldLabel>
                  <Input {...field} value={editing ? field.value : ""} id="emp-id" autoComplete="off" readOnly disabled={!editing} placeholder="Assigned automatically" aria-invalid={fieldState.invalid} className="bg-muted/50" />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    editing && <FieldDescription>The ID can&apos;t change once created.</FieldDescription>
                  )}
                </Field>
              )}
            />
            <Controller
              name="joiningDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="emp-joined">Joining date</FieldLabel>
                  <Input {...field} id="emp-joined" type="date" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="emp-email">Email</FieldLabel>
                  <Input {...field} id="emp-email" type="email" autoComplete="off" placeholder="name@company.com" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="emp-phone">Phone number</FieldLabel>
                  <Input {...field} id="emp-phone" type="tel" autoComplete="off" placeholder="+91 98765 43210" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              name="department"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="emp-department">Department</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="emp-department" className="w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Choose a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="designation"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="emp-designation">Designation</FieldLabel>
                  <Input {...field} id="emp-designation" autoComplete="off" placeholder="For example, Product Analyst" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>

          <Controller
            name="monthlyBasicSalary"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="emp-salary">Monthly basic salary</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
                    ₹
                  </span>
                  <Input
                    id="emp-salary"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={500}
                    placeholder="30000"
                    aria-invalid={fieldState.invalid}
                    className="pl-7 tabular-nums"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(event) => field.onChange(event.target.value === "" ? NaN : event.target.valueAsNumber)}
                  />
                </div>
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription>Used to estimate the monthly salary from approved attendance.</FieldDescription>
                )}
              </Field>
            )}
          />

          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel>Account status</FieldLabel>
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["active", "Active", "Can check in and is paid"],
                      ["inactive", "Inactive", "No check-in, history kept"],
                    ] as const
                  ).map(([value, title, hint]) => (
                    <label
                      key={value}
                      htmlFor={`emp-status-${value}`}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent/50"
                    >
                      <RadioGroupItem id={`emp-status-${value}`} value={value} className="mt-0.5" />
                      <span>
                        <span className="block font-medium">{title}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </Field>
            )}
          />
        </FieldGroup>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t bg-card px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner />}
          {editing ? "Save Changes" : "Add Employee"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function EmployeeForm({ open, onOpenChange, employee }: EmployeeFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The base sheet sets its width through data-[side=right] variants, so the overrides must use them too. */}
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5 pr-14">
          <SheetTitle className="text-lg font-semibold">{employee ? "Edit employee" : "Add employee"}</SheetTitle>
          <SheetDescription>
            {employee
              ? `Update ${employee.fullName}'s details. Changes apply everywhere straight away.`
              : "Create an account. The employee appears in the list, on payroll and on the dashboard immediately."}
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so every visit starts from fresh defaults. */}
        {open && <EmployeeFormBody employee={employee} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}
