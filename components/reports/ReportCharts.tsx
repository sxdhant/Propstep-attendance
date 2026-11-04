"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  STATUS_COLORS,
  STATUS_NAMES,
  makeSegmentShape,
} from "@/components/dashboard/AttendanceChart";
import { ChartTooltip } from "@/components/dashboard/ChartTooltip";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/format";
import type { PayrollMonthTotals } from "@/lib/selectors/reports";
import {
  CHART_STATUS_META,
  CHART_STATUS_ORDER,
  CHART_THEME,
  PAYROLL_CHART_COLORS,
} from "@/lib/status-config";
import type { StatusCounts } from "@/lib/selectors/admin";

const ROW_SEGMENT = makeSegmentShape("right", CHART_STATUS_ORDER);
const PAYROLL_ORDER = ["not_generated", "draft", "finalized", "paid"] as const;
const COLUMN_PAYROLL_SEGMENT = makeSegmentShape("up", PAYROLL_ORDER);

const rowHeight = (count: number) => Math.max(180, 48 + count * 36);

export interface EmployeeBarDatum extends StatusCounts {
  name: string;
}

/** One horizontal stack per employee, using the same status colors as every other chart. */
export function EmployeeStatusChart({ data, ariaLabel }: { data: EmployeeBarDatum[]; ariaLabel: string }) {
  const height = rowHeight(data.length);
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={CHART_THEME.grid} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis
            type="category"
            dataKey="name"
            width={116}
            tickLine={false}
            axisLine={{ stroke: CHART_THEME.axis }}
            tick={AXIS_TICK}
          />
          <Tooltip
            cursor={{ fill: CHART_THEME.cursor }}
            content={
              <ChartTooltip
                colors={STATUS_COLORS}
                names={STATUS_NAMES}
                showTotal
                hideZero
                reverse
                title={(label) => String(label ?? "")}
                format={(value) => `${formatNumber(value)} ${value === 1 ? "day" : "days"}`}
              />
            }
          />
          {CHART_STATUS_ORDER.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="employee"
              fill={CHART_STATUS_META[status].color}
              maxBarSize={20}
              isAnimationActive={false}
              shape={ROW_SEGMENT}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface SingleSeriesDatum {
  name: string;
  value: number;
}

/**
 * Ranked horizontal bars for one measure. One series means one color and no
 * legend; the title and tooltip say what is being measured.
 */
export function RankedBars({
  data,
  color = CHART_THEME.accent,
  seriesName,
  format,
  tickFormat,
  ariaLabel,
}: {
  data: SingleSeriesDatum[];
  color?: string;
  seriesName: string;
  format: (value: number) => string;
  tickFormat?: (value: number) => string;
  ariaLabel: string;
}) {
  const height = rowHeight(data.length);
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={CHART_THEME.grid} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={tickFormat}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={116}
            tickLine={false}
            axisLine={{ stroke: CHART_THEME.axis }}
            tick={AXIS_TICK}
          />
          <Tooltip
            cursor={{ fill: CHART_THEME.cursor }}
            content={
              <ChartTooltip
                title={(label) => String(label ?? "")}
                names={{ value: seriesName }}
                colors={{ value: color }}
                format={format}
              />
            }
          />
          <Bar
            dataKey="value"
            fill={color}
            maxBarSize={20}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const PAYROLL_NAMES: Record<string, string> = {
  not_generated: "Not generated (estimate)",
  draft: "Draft",
  finalized: "Finalized",
  paid: "Paid",
};

/**
 * Payroll moves draft, then finalized, then paid, which is an ordered
 * progression, so it takes a single-hue ramp from light to dark.
 */
export function PayrollMonthChart({ data, height = 280 }: { data: PayrollMonthTotals[]; height?: number }) {
  return (
    <div
      role="img"
      aria-label="Payroll total for each month, split by draft, finalized and paid"
      style={{ height }}
      className="min-w-0"
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="34%">
          <CartesianGrid vertical={false} stroke={CHART_THEME.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: CHART_THEME.axis }} tick={AXIS_TICK} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={56}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
          />
          <Tooltip
            cursor={{ fill: CHART_THEME.cursor }}
            content={
              <ChartTooltip
                colors={PAYROLL_CHART_COLORS}
                names={PAYROLL_NAMES}
                showTotal
                hideZero
                reverse
                format={(value) => formatCurrency(value)}
              />
            }
          />
          {PAYROLL_ORDER.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="payroll"
              fill={PAYROLL_CHART_COLORS[key]}
              maxBarSize={48}
              isAnimationActive={false}
              shape={COLUMN_PAYROLL_SEGMENT}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const PAYROLL_LEGEND = PAYROLL_ORDER.map((key) => ({
  label: PAYROLL_NAMES[key],
  color: PAYROLL_CHART_COLORS[key],
}));
