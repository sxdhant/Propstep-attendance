import { formatDate, formatDateTime, formatMonthYear, formatTime, formatWeekday } from "@/lib/format";
import type { ApprovalRow } from "@/lib/selectors/admin";
import type { ReportRow } from "@/lib/selectors/reports";
import { ATTENDANCE_STATUS_META, APPROVAL_STATUS_META, PAYROLL_STATUS_META } from "@/lib/status-config";
import type { PayrollRow } from "@/types/payroll";

/**
 * Client-side CSV export. Files include a UTF-8 byte-order mark so Excel
 * shows names and the rupee sign correctly, and any text that could be read
 * as a spreadsheet formula is neutralised.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(","));
  return [header, ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------ report builders ------------------------------ */

const hoursOf = (minutes: number | null | undefined) =>
  minutes === null || minutes === undefined ? "" : Number((minutes / 60).toFixed(2));

export function buildAttendanceCsv(rows: ReportRow[]): string {
  return toCsv<ReportRow>(rows, [
    { header: "Employee ID", value: ({ employee }) => employee.id },
    { header: "Employee name", value: ({ employee }) => employee.fullName },
    { header: "Department", value: ({ employee }) => employee.department },
    { header: "Date", value: ({ entry }) => entry.date },
    { header: "Day", value: ({ entry }) => formatWeekday(entry.date, "long") },
    { header: "Check-in", value: ({ entry }) => formatTime(entry.record?.checkIn).replace("—", "") },
    { header: "Check-out", value: ({ entry }) => formatTime(entry.record?.checkOut).replace("—", "") },
    { header: "Hours worked", value: ({ entry }) => hoursOf(entry.record?.workedMinutes) },
    { header: "Attendance status", value: ({ entry }) => ATTENDANCE_STATUS_META[entry.attendanceStatus].label },
    {
      header: "Approval status",
      value: ({ entry }) =>
        entry.approvalStatus === "not_required" ? "" : APPROVAL_STATUS_META[entry.approvalStatus].label,
    },
    { header: "Late by (minutes)", value: ({ entry }) => (entry.record?.isLate ? entry.record.lateMinutes : "") },
    { header: "Remarks", value: ({ entry }) => entry.record?.remarks ?? entry.holidayName ?? "" },
    { header: "Rejection reason", value: ({ entry }) => entry.record?.rejectionReason ?? "" },
  ]);
}

export function buildApprovalCsv(rows: ApprovalRow[]): string {
  return toCsv<ApprovalRow>(rows, [
    { header: "Employee ID", value: ({ employee }) => employee.id },
    { header: "Employee name", value: ({ employee }) => employee.fullName },
    { header: "Date", value: ({ record }) => record.date },
    { header: "Check-in", value: ({ record }) => formatTime(record.checkIn).replace("—", "") },
    { header: "Check-out", value: ({ record }) => formatTime(record.checkOut).replace("—", "") },
    { header: "Hours worked", value: ({ record }) => hoursOf(record.workedMinutes) },
    { header: "Attendance status", value: ({ record }) => ATTENDANCE_STATUS_META[record.effectiveStatus].label },
    { header: "Approval status", value: ({ record }) => APPROVAL_STATUS_META[record.approval].label },
    { header: "Reviewed at", value: ({ record }) => (record.reviewedAt ? formatDateTime(record.reviewedAt) : "") },
    { header: "Rejection reason", value: ({ record }) => record.rejectionReason ?? "" },
  ]);
}

export function buildPayrollCsv(rows: PayrollRow[]): string {
  return toCsv<PayrollRow>(rows, [
    { header: "Payroll month", value: (row) => formatMonthYear(row.year, row.month) },
    { header: "Employee ID", value: (row) => row.employee.id },
    { header: "Employee name", value: (row) => row.employee.fullName },
    { header: "Department", value: (row) => row.employee.department },
    { header: "Monthly basic salary", value: (row) => row.figures.monthlyBasicSalary },
    { header: "Scheduled working days", value: (row) => row.figures.scheduledWorkingDays },
    { header: "Salary divisor", value: (row) => row.figures.divisor },
    { header: "Approved full days", value: (row) => row.figures.approvedFullDays },
    { header: "Approved half days", value: (row) => row.figures.approvedHalfDays },
    { header: "Absent days", value: (row) => row.figures.unpaidDays },
    { header: "Pending days", value: (row) => row.figures.pendingDays },
    { header: "Payable attendance units", value: (row) => row.figures.payableUnits },
    { header: "Estimated salary", value: (row) => row.figures.estimatedSalary },
    { header: "Payroll status", value: (row) => PAYROLL_STATUS_META[row.status].label },
    { header: "Finalized at", value: (row) => (row.record?.finalizedAt ? formatDateTime(row.record.finalizedAt) : "") },
    { header: "Paid on", value: (row) => (row.record?.paidAt ? formatDate(row.record.paidAt.slice(0, 10)) : "") },
    { header: "Payment reference", value: (row) => row.record?.paymentReference ?? "" },
  ]);
}
