import { StatusBadge } from "@/components/shared/StatusBadge";
import { PAYROLL_STATUS_META } from "@/lib/status-config";
import type { PayrollStatus } from "@/types/payroll";

export function PayrollStatusBadge({
  status,
  label,
  className,
}: {
  status: PayrollStatus | "not_generated";
  /** Overrides the wording, e.g. "In Progress" where "Not Generated" is admin jargon. */
  label?: string;
  className?: string;
}) {
  return <StatusBadge meta={PAYROLL_STATUS_META[status]} label={label} className={className} />;
}
