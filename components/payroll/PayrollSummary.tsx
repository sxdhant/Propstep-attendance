import { BadgeCheck, Hourglass, ReceiptIndianRupee, Users } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency, formatMonthYear, pluralize } from "@/lib/format";
import type { PayrollTotals } from "@/lib/selectors/payroll";

interface PayrollSummaryProps {
  totals: PayrollTotals;
  year: number;
  month: number;
}

/** The four headline numbers for a payroll month. */
export function PayrollSummary({ totals, year, month }: PayrollSummaryProps) {
  const settled = totals.finalizedCount + totals.paidCount;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        label="Total Employees"
        value={totals.employees}
        hint={`On the ${formatMonthYear(year, month)} payroll`}
        icon={Users}
        tone="blue"
      />
      <StatCard
        label="Estimated Payroll"
        value={formatCurrency(totals.estimated)}
        hint={`${formatCurrency(totals.basicTotal)} at full attendance`}
        icon={ReceiptIndianRupee}
        tone="blue"
      />
      <StatCard
        label="Finalized Payroll"
        value={formatCurrency(totals.finalized)}
        hint={`${settled} of ${pluralize(totals.employees, "employee")} finalized`}
        icon={BadgeCheck}
        tone="green"
      />
      <StatCard
        label="Unpaid Salaries"
        value={formatCurrency(totals.unpaid)}
        hint={
          totals.unpaidCount > 0
            ? `${pluralize(totals.unpaidCount, "finalized salary", "finalized salaries")} awaiting payment`
            : "Nothing awaiting payment"
        }
        icon={Hourglass}
        tone={totals.unpaidCount > 0 ? "orange" : "gray"}
      />
    </div>
  );
}
