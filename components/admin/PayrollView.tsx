"use client";

import { CalendarClock, Download, Info, Lock, RefreshCw, ReceiptIndianRupee, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FinalizeAllDialog, FinalizeDialog, MarkPaidDialog } from "@/components/payroll/PayrollActionDialogs";
import { PayrollCardList } from "@/components/payroll/PayrollCardList";
import { PayrollSummary } from "@/components/payroll/PayrollSummary";
import { PayrollTable } from "@/components/payroll/PayrollTable";
import { SalaryBreakdown } from "@/components/payroll/SalaryBreakdown";
import { EmptyState } from "@/components/shared/EmptyState";
import { MonthYearPicker } from "@/components/shared/MonthYearPicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { Spinner } from "@/components/shared/LoadingState";
import { FilterSelect, SearchFilters, SearchInput } from "@/components/shared/SearchFilters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { useAppData } from "@/hooks/use-app-data";
import { compareMonths, monthEnd, monthOf } from "@/lib/date-utils";
import { buildPayrollCsv, downloadCsv } from "@/lib/export-utils";
import { formatMonthYear, pluralize } from "@/lib/format";
import { getDataWindowStart } from "@/lib/selectors/context";
import { selectPayrollRows, summarizePayrollRows } from "@/lib/selectors/payroll";
import { generatePayroll } from "@/lib/services/payroll-service";
import type { MonthRef } from "@/types/common";
import type { PayrollRow } from "@/types/payroll";

type StatusFilter = "all" | "not_generated" | "draft" | "finalized" | "paid";

type RowDialog = { kind: "view" | "finalize" | "paid"; key: string; open: boolean };

const rowKey = (row: PayrollRow) => `${row.employee.id}-${row.year}-${row.month}`;

export function AdminPayrollView() {
  const { db, ctx, admin, today } = useAppData();
  const current = monthOf(today);
  const [period, setPeriod] = useState<MonthRef>(current);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dialog, setDialog] = useState<RowDialog | null>(null);
  const [finalizeAllOpen, setFinalizeAllOpen] = useState(false);
  const [runGenerate, generating] = useAction(generatePayroll);

  const earliest = useMemo(() => getDataWindowStart(db), [db]);
  const activePeriod =
    compareMonths(period, current) > 0 ? current : compareMonths(period, earliest) < 0 ? earliest : period;
  const label = formatMonthYear(activePeriod.year, activePeriod.month);

  const allRows = useMemo(
    () =>
      selectPayrollRows(db, ctx, activePeriod.year, activePeriod.month).sort((a, b) =>
        a.employee.id.localeCompare(b.employee.id, undefined, { numeric: true }),
      ),
    [db, ctx, activePeriod.year, activePeriod.month],
  );
  const totals = useMemo(() => summarizePayrollRows(allRows), [allRows]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows.filter(
      (row) =>
        (status === "all" || row.status === status) &&
        (!query || row.employee.fullName.toLowerCase().includes(query) || row.employee.id.toLowerCase().includes(query)),
    );
  }, [allRows, search, status]);

  const monthInProgress = current.year === activePeriod.year && current.month === activePeriod.month && today < monthEnd(current.year, current.month);
  const hasRecords = totals.employees > totals.notGeneratedCount;
  const draftTotal = allRows.filter((row) => row.status === "draft").reduce((sum, row) => sum + row.figures.estimatedSalary, 0);
  const filtersActive = search.trim() !== "" || status !== "all";

  const dialogRow = dialog ? (allRows.find((row) => rowKey(row) === dialog.key) ?? null) : null;
  const open = (kind: RowDialog["kind"], row: PayrollRow) => setDialog({ kind, key: rowKey(row), open: true });
  const setOpen = (value: boolean) => setDialog((state) => (state ? { ...state, open: value } : state));

  const generate = async () => {
    const result = await runGenerate({ year: activePeriod.year, month: activePeriod.month, adminId: admin.id });
    if (!result.ok) {
      toast.error("Couldn't generate payroll", { description: result.error });
      return;
    }
    const { created, refreshed, locked } = result.data;
    toast.success(`Payroll generated for ${label}`, {
      description: [
        created ? `${pluralize(created, "draft")} created` : null,
        refreshed ? `${pluralize(refreshed, "draft")} recalculated` : null,
        locked ? `${locked} locked line${locked === 1 ? "" : "s"} left untouched` : null,
      ]
        .filter(Boolean)
        .join(", "),
    });
  };

  const exportReport = () => {
    downloadCsv(
      `payroll-${activePeriod.year}-${String(activePeriod.month).padStart(2, "0")}.csv`,
      buildPayrollCsv(rows),
    );
    toast.success("Payroll report exported", { description: `${pluralize(rows.length, "line")} saved as CSV.` });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Generate a month's payroll from approved attendance, lock it, then record payment. Recording a payment stores its reference only; no money moves through this app."
        actions={
          <>
            <MonthYearPicker
              value={activePeriod}
              onChange={setPeriod}
              min={earliest}
              max={current}
            />
            <Button variant="outline" onClick={exportReport} disabled={rows.length === 0}>
              <Download className="size-4" aria-hidden />
              Export Report
            </Button>
            <Button onClick={generate} disabled={generating || allRows.length === 0}>
              {generating ? <Spinner /> : hasRecords ? <RefreshCw className="size-4" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
              {hasRecords ? "Recalculate Payroll" : "Generate Payroll"}
            </Button>
          </>
        }
      />

      <PayrollSummary totals={totals} year={activePeriod.year} month={activePeriod.month} />

      {!hasRecords && allRows.length > 0 && (
        <Alert>
          <Info aria-hidden />
          <AlertTitle>Payroll for {label} hasn&apos;t been generated</AlertTitle>
          <AlertDescription>
            The figures below are live estimates from attendance approved so far. Generate payroll to create draft
            lines you can review, finalize and mark as paid.
          </AlertDescription>
        </Alert>
      )}
      {monthInProgress && hasRecords && totals.draftCount > 0 && (
        <Alert className="border-orange-200 bg-orange-50 text-orange-900">
          <CalendarClock aria-hidden />
          <AlertTitle>{label} is still in progress</AlertTitle>
          <AlertDescription className="text-orange-900/90">
            Draft lines update automatically as you approve attendance. Finalize only when the month is complete.
          </AlertDescription>
        </Alert>
      )}

      <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <header className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">{label} payroll</h2>
            <p className="text-sm text-muted-foreground">
              {pluralize(allRows.length, "employee")}
              {totals.draftCount > 0 ? `, ${totals.draftCount} draft` : ""}
              {totals.finalizedCount > 0 ? `, ${totals.finalizedCount} awaiting payment` : ""}
              {totals.paidCount > 0 ? `, ${totals.paidCount} paid` : ""}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchFilters
              active={filtersActive}
              onClear={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              <SearchInput value={search} onChange={setSearch} placeholder="Search by name or ID" className="w-full sm:w-60" />
              <FilterSelect
                ariaLabel="Filter by payroll status"
                value={status}
                onValueChange={(value) => setStatus(value as StatusFilter)}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "not_generated", label: "Not Generated" },
                  { value: "draft", label: "Draft" },
                  { value: "finalized", label: "Finalized" },
                  { value: "paid", label: "Paid" },
                ]}
              />
            </SearchFilters>
            {totals.draftCount > 0 && (
              <Button variant="outline" onClick={() => setFinalizeAllOpen(true)}>
                <Lock className="size-4" aria-hidden />
                Finalize All Drafts ({totals.draftCount})
              </Button>
            )}
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="border-t">
            <EmptyState
              icon={ReceiptIndianRupee}
              title={allRows.length === 0 ? "No employees on this month's payroll" : "No payroll lines match these filters"}
              description={
                allRows.length === 0
                  ? "Employees appear here from the month they join."
                  : "Clear the search or choose another status."
              }
            />
          </div>
        ) : (
          <div className="border-t">
            {/* The full ledger from tablet width up, one card per employee on phones. */}
            <div className="hidden md:block">
              <PayrollTable
                rows={rows}
                onView={(row) => open("view", row)}
                onFinalize={(row) => open("finalize", row)}
                onMarkPaid={(row) => open("paid", row)}
              />
            </div>
            <div className="md:hidden">
              <PayrollCardList
                rows={rows}
                onView={(row) => open("view", row)}
                onFinalize={(row) => open("finalize", row)}
                onMarkPaid={(row) => open("paid", row)}
              />
            </div>
          </div>
        )}
      </section>

      <SalaryBreakdown row={dialogRow} open={dialog?.kind === "view" && dialog.open} onOpenChange={setOpen} showEmployee />
      <FinalizeDialog row={dialogRow} open={dialog?.kind === "finalize" && dialog.open} onOpenChange={setOpen} />
      <MarkPaidDialog row={dialogRow} open={dialog?.kind === "paid" && dialog.open} onOpenChange={setOpen} />
      <FinalizeAllDialog
        year={activePeriod.year}
        month={activePeriod.month}
        count={totals.draftCount}
        total={draftTotal}
        open={finalizeAllOpen}
        onOpenChange={setFinalizeAllOpen}
      />
    </div>
  );
}
