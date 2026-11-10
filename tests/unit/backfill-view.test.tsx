// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB_VERSION, DEFAULT_SETTINGS } from "@/lib/constants";
import { createAttendanceContext } from "@/lib/selectors/context";
import type { Database } from "@/types/database";
import type { Employee } from "@/types/employee";

const employee: Employee = {
  id: "EMP-1001", fullName: "Priya Nair", email: "p@x.example", phone: "+91 90000 00000", department: "Eng",
  designation: "Dev", joiningDate: "2026-10-01", monthlyBasicSalary: 30000, status: "active",
};
const db: Database = {
  version: DB_VERSION, seededAt: "2026-11-04T10:00:00+05:30", clockOffsetMs: 0,
  settings: { ...structuredClone(DEFAULT_SETTINGS), attendance: { ...DEFAULT_SETTINGS.attendance, weeklyOffs: [2] } }, // Tuesday is the weekly off
  admins: [{ id: "ADM-001", fullName: "Admin", email: "a@x.example", title: "Administrator" }],
  employees: [employee], attendance: {}, payroll: {}, notifications: [], holidays: [],
};
const nowMs = new Date("2026-11-04T07:00:00Z").getTime();
const ctx = createAttendanceContext(db, nowMs);

vi.mock("@/hooks/use-app-data", () => ({
  useAppData: () => ({ db, nowMs, today: ctx.today, ctx, role: "admin", admin: db.admins[0], employee, session: {}, user: {}, recipientId: "admin" }),
}));
const previewBackfill = vi.fn();
const saveBackfill = vi.fn();
vi.mock("@/lib/services/attendance-service", () => ({
  previewBackfill: (...a: unknown[]) => previewBackfill(...a),
  saveBackfill: (...a: unknown[]) => saveBackfill(...a),
}));

async function renderView() {
  const { BackfillView } = await import("@/components/admin/BackfillView");
  const view = render(<BackfillView />);
  // The first open month is May; these tests use the employee who joined in October.
  await userEvent.selectOptions(screen.getByLabelText("Month"), "2026-10");
  return view;
}

beforeEach(() => {
  previewBackfill.mockReset();
  saveBackfill.mockReset();
});
afterEach(cleanup);

describe("Add past attendance: monthly grid", () => {
  it("shows every day of October and blocks weekly offs", async () => {
    await renderView();
    expect(screen.getByText(/Enter attendance for October 2026/)).toBeTruthy();
    expect(screen.getAllByRole("combobox", { name: /Attendance for/ })).toHaveLength(27); // 31 days minus 4 Tuesdays
    expect(screen.getAllByText("Weekly off")).toHaveLength(4);
  });

  it("marks every working day Present, checks the rows, then saves them", async () => {
    const user = userEvent.setup();
    previewBackfill.mockResolvedValue({ ok: true, data: { dryRun: true, results: [], summary: { rows: 27, errors: 0, toSave: 27, toClear: 0 } } });
    saveBackfill.mockResolvedValue({ ok: true, data: { dryRun: false, created: 27, updated: 0, cleared: 0, employees: 1 } });
    await renderView();

    await user.click(screen.getByRole("button", { name: /Mark all working days Present/ }));
    expect(screen.getByText(/27 present, 0 half day, 0 absent/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Save 27 changes/ }));
    await waitFor(() => expect(saveBackfill).toHaveBeenCalledTimes(1));

    // The rows are checked first (nothing saved), then saved; all 27 are Present with default times.
    expect(previewBackfill).toHaveBeenCalledTimes(1);
    const sent = saveBackfill.mock.calls[0][0] as Array<{ employeeId: string; date: string; status: string }>;
    expect(sent).toHaveLength(27);
    expect(sent.every((e) => e.employeeId === "EMP-1001" && e.status === "present")).toBe(true);
    expect(sent.some((e) => e.date === "2026-10-13")).toBe(false); // a Tuesday
    expect(sent[0].date).toBe("2026-10-01");
  });

  it("sends custom times and half days, and does not save when the server finds a problem", async () => {
    const user = userEvent.setup();
    previewBackfill.mockResolvedValue({
      ok: true,
      data: { dryRun: true, summary: { rows: 1, errors: 1, toSave: 0, toClear: 0 }, results: [{ index: 0, employeeId: "EMP-1001", date: "2026-10-14", ok: false, error: "Check-out must be after check-in." }] },
    });
    await renderView();

    const day = screen.getByRole("combobox", { name: "Attendance for 14 Oct 2026" });
    await user.selectOptions(day, "half_day");
    fireEvent.change(screen.getByLabelText("Check-in time for 14 Oct 2026"), { target: { value: "15:00" } });
    fireEvent.change(screen.getByLabelText("Check-out time for 14 Oct 2026"), { target: { value: "09:00" } });
    await user.click(screen.getByRole("button", { name: /Save 1 change/ }));

    await waitFor(() => expect(previewBackfill).toHaveBeenCalled());
    expect(previewBackfill.mock.calls[0][0]).toEqual([
      { employeeId: "EMP-1001", date: "2026-10-14", status: "half_day", checkIn: "15:00", checkOut: "09:00" },
    ]);
    expect(await screen.findByText("Check-out must be after check-in.")).toBeTruthy();
    expect(saveBackfill).not.toHaveBeenCalled();
  });
});

describe("Add past attendance: CSV import", () => {
  it("checks an uploaded file, reports problems by row, and only offers import when it is clean", async () => {
    const user = userEvent.setup();
    previewBackfill.mockResolvedValue({
      ok: true,
      data: {
        dryRun: true,
        summary: { rows: 2, errors: 1, toSave: 1, toClear: 0 },
        results: [
          { index: 0, employeeId: "EMP-1001", date: "2026-10-14", ok: true, action: "save" },
          { index: 1, employeeId: "EMP-1001", date: "2026-10-13", ok: false, error: "2026-10-13 is a weekly off." },
        ],
      },
    });
    await renderView();
    await user.click(screen.getByRole("button", { name: "CSV import" }));

    const csv = "employee_id,date,status\nEMP-1001,2026-10-14,present\nEMP-1001,2026-10-13,present\n";
    const file = new File([csv], "october.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(csv) });
    await user.upload(screen.getByLabelText("Upload attendance CSV"), file);

    expect(await screen.findByText(/2 rows checked: 1 to save, 0 to clear, 1 with problems/)).toBeTruthy();
    expect(screen.getByText(/2026-10-13 is a weekly off/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Import/ })).toBeNull();
    expect(saveBackfill).not.toHaveBeenCalled();
  });

  it("imports a clean file after the check", async () => {
    const user = userEvent.setup();
    previewBackfill.mockResolvedValue({
      ok: true,
      data: { dryRun: true, summary: { rows: 1, errors: 0, toSave: 1, toClear: 0 }, results: [{ index: 0, employeeId: "EMP-1001", date: "2026-10-14", ok: true, action: "save" }] },
    });
    saveBackfill.mockResolvedValue({ ok: true, data: { dryRun: false, created: 1, updated: 0, cleared: 0, employees: 1 } });
    await renderView();
    await user.click(screen.getByRole("button", { name: "CSV import" }));

    await user.click(screen.getByText("Or paste CSV text"));
    await user.type(screen.getByLabelText("Attendance CSV text"), "employee_id,date,status{enter}EMP-1001,2026-10-14,P");
    await user.click(screen.getByRole("button", { name: "Check pasted text" }));
    await user.click(await screen.findByRole("button", { name: /Import 1 row/ }));

    await waitFor(() => expect(saveBackfill).toHaveBeenCalledWith([{ employeeId: "EMP-1001", date: "2026-10-14", status: "present" }]));
  });

  it("explains a malformed file without calling the server", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("button", { name: "CSV import" }));
    await user.click(screen.getByText("Or paste CSV text"));
    await user.type(screen.getByLabelText("Attendance CSV text"), "foo,bar{enter}1,2");
    await user.click(screen.getByRole("button", { name: "Check pasted text" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/employee_id, date and status/)).toBeTruthy();
    expect(previewBackfill).not.toHaveBeenCalled();
  });
});
