// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { attendanceId } from "@/lib/attendance-utils";
import { DB_VERSION, DEFAULT_SETTINGS } from "@/lib/constants";
import { createAttendanceContext } from "@/lib/selectors/context";
import type { Database } from "@/types/database";
import type { Employee } from "@/types/employee";

const person = (id: string, name: string, over: Partial<Employee> = {}): Employee => ({
  id, fullName: name, email: `${id}@x.example`, phone: "+91 90000 00000", department: "Engineering",
  designation: "Dev", joiningDate: "2025-01-01", monthlyBasicSalary: 30000, status: "active", ...over,
});
const rec = (employeeId: string, checkIn: string, checkOut: string | null = null, approval: "pending" | "approved" = "pending") => ({
  id: attendanceId(employeeId, "2026-11-04"), employeeId, date: "2026-11-04", checkIn, checkOut,
  status: (checkOut ? "present" : "in_progress") as "present" | "in_progress", approval,
});

// Wednesday 2026-11-04, 12:30 IST: past the 10:15 cutoff.
const db: Database = {
  version: DB_VERSION, seededAt: "2026-11-04T10:00:00+05:30", clockOffsetMs: 0,
  settings: structuredClone(DEFAULT_SETTINGS),
  admins: [{ id: "ADM-001", fullName: "Sidhyant Admin", email: "a@x.example", title: "Administrator" }],
  employees: [person("EMP-1", "Zara Late"), person("EMP-2", "Adam Early"), person("EMP-3", "Mia Missing")],
  attendance: {
    [attendanceId("EMP-1", "2026-11-04")]: rec("EMP-1", "2026-11-04T10:20:00+05:30"),
    [attendanceId("EMP-2", "2026-11-04")]: rec("EMP-2", "2026-11-04T09:55:00+05:30", "2026-11-04T12:00:00+05:30", "approved"),
  },
  payroll: {}, notifications: [], holidays: [],
};
const nowMs = new Date("2026-11-04T07:00:00Z").getTime();
const ctx = createAttendanceContext(db, nowMs);

vi.mock("@/hooks/use-app-data", () => ({
  useAppData: () => ({
    db, nowMs, today: ctx.today, ctx, role: "admin",
    session: { role: "admin", employeeId: "", adminId: "ADM-001" },
    employee: db.employees[0], admin: db.admins[0],
    user: { name: "Sidhyant Admin", email: "a@x.example", subtitle: "Administrator" },
    recipientId: "admin",
  }),
}));

beforeAll(() => {
  // Charts measure their container; jsdom has no layout engine.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

async function renderDashboard() {
  const { AdminDashboardView } = await import("@/components/admin/DashboardView");
  return render(<AdminDashboardView />);
}

describe("admin dashboard: expandable cards", () => {
  it("shows no names until a card is clicked", async () => {
    await renderDashboard();
    expect(screen.queryByRole("region", { name: "Present today" })).toBeNull();
    expect(screen.getByRole("button", { name: /Present Today/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("counts only approved check-ins as present, and lists waiting ones separately", async () => {
    const user = userEvent.setup();
    await renderDashboard();

    // Two people have checked in, but only Adam is approved, so the card says 1 (not 2).
    const card = screen.getByRole("button", { name: /Present Today/ });
    expect(within(card).getByText("1")).toBeTruthy();
    expect(card.textContent).toContain("1 awaiting approval");

    await user.click(card);
    const panel = screen.getByRole("region", { name: "Present today" });
    const rows = within(panel).getAllByRole("listitem");
    // [Adam (approved), group header, Zara (awaiting)]
    expect(rows[0].textContent).toContain("Adam Early");
    expect(rows[0].textContent).toContain("09:55 AM");
    expect(rows[0].textContent).toContain("Out 12:00 PM");
    expect(rows[0].textContent).toContain("Approved");
    expect(rows[1].textContent).toContain("waiting for your approval");
    expect(rows[2].textContent).toContain("Zara Late");
    expect(rows[2].textContent).toContain("10:20 AM");
    expect(rows[2].textContent).toContain("Awaiting approval");
    expect(rows[2].textContent).toContain("Late by 20 min");
    expect(within(panel).getByText(/1 approved, 1 awaiting approval/)).toBeTruthy();
    expect(card.getAttribute("aria-expanded")).toBe("true");
  });

  it("Absent Today lists the person who never checked in, and switching cards swaps the panel", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole("button", { name: /Present Today/ }));
    await user.click(screen.getByRole("button", { name: /Absent Today/ }));

    expect(screen.queryByRole("region", { name: "Present today" })).toBeNull();
    const panel = screen.getByRole("region", { name: "Absent today" });
    expect(within(panel).getByText("Mia Missing")).toBeTruthy();
    expect(within(panel).getByText("No check-in")).toBeTruthy();
    expect(within(panel).getAllByText(/No check-in by 10:00/).length).toBeGreaterThan(0);
    expect(within(panel).queryByText("Zara Late")).toBeNull();
  });

  it("Total Employees lists everyone with their status and links to employee management", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole("button", { name: /Total Employees/ }));

    const panel = screen.getByRole("region", { name: "All employees" });
    for (const name of ["Zara Late", "Adam Early", "Mia Missing"]) expect(within(panel).getByText(name)).toBeTruthy();
    expect(within(panel).getByText(/1 present, 1 awaiting approval, 1 absent, 0 other/)).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "Manage employees" }).getAttribute("href")).toBe("/admin/employees");
  });

  it("collapses on a second click, on the close button and on Escape", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    const card = screen.getByRole("button", { name: /Present Today/ });

    await user.click(card);
    await user.click(card);
    expect(screen.queryByRole("region", { name: "Present today" })).toBeNull();

    await user.click(card);
    await user.click(screen.getByRole("button", { name: /Close present today/i }));
    expect(screen.queryByRole("region", { name: "Present today" })).toBeNull();

    await user.click(card);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Present today" })).toBeNull();
  });

  it("clicking a person opens that employee's attendance details", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole("button", { name: /Present Today/ }));
    const panel = screen.getByRole("region", { name: "Present today" });
    await user.click(within(within(panel).getAllByRole("listitem")[0]).getAllByRole("button")[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText(/Adam Early/).length).toBeGreaterThan(0);
  });
});
