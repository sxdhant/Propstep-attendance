"use client";

import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/dashboard/ChartTooltip";
import { formatDate, formatNumber } from "@/lib/format";
import type { StatusCounts, TrendPoint } from "@/lib/selectors/admin";
import type { TrendBucket } from "@/lib/selectors/reports";
import { CHART_STATUS_META, CHART_STATUS_ORDER, CHART_THEME } from "@/lib/status-config";
import type { ChartStatus } from "@/types/attendance";

/* -------------------------------- shared bits -------------------------------- */

export const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  CHART_STATUS_ORDER.map((status) => [status, CHART_STATUS_META[status].color]),
);
export const STATUS_NAMES: Record<string, string> = Object.fromEntries(
  CHART_STATUS_ORDER.map((status) => [status, CHART_STATUS_META[status].label]),
);

export const AXIS_TICK = { fill: CHART_THEME.tick, fontSize: 12 } as const;

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

/**
 * One segment of a stacked bar: a 2px surface-colored edge separates it from
 * its neighbours, and only the outermost non-empty segment gets rounded
 * corners, so every stack ends in a clean 4px cap anchored to the baseline.
 */
export function makeSegmentShape(orientation: "up" | "right", order: readonly string[]) {
  return function SegmentShape(props: unknown) {
    const { x = 0, y = 0, width = 0, height = 0, fill, dataKey, payload } = props as SegmentProps;
    if (!(width > 0) || !(height > 0)) return <g />;

    const index = dataKey ? order.indexOf(dataKey) : -1;
    const isOutermost = index >= 0 && order.slice(index + 1).every((key) => !(Number(payload?.[key]) > 0));
    const r = isOutermost ? Math.min(4, orientation === "up" ? width / 2 : height / 2, orientation === "up" ? height : width) : 0;

    const d =
      orientation === "up"
        ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
        : `M${x},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} L${x},${y + height} Z`;

    return <path d={d} fill={fill} stroke={CHART_THEME.surface} strokeWidth={2} />;
  };
}

const COLUMN_SEGMENT = makeSegmentShape("up", CHART_STATUS_ORDER);

/* ------------------------------ trend (stacked) ------------------------------ */

export interface TrendDatum extends StatusCounts {
  /** Axis label, e.g. the day of the month. */
  label: string;
  /** Tooltip heading, e.g. "Friday, 30 October 2026". */
  title: string;
}

export function trendPointsToData(points: TrendPoint[]): TrendDatum[] {
  return points.map((point) => ({
    approved: point.approved,
    absent: point.absent,
    pending: point.pending,
    rejected: point.rejected,
    incomplete: point.incomplete,
    label: point.label,
    title: formatDate(point.date, "long"),
  }));
}

export function trendBucketsToData(buckets: TrendBucket[], granularity: "day" | "month"): TrendDatum[] {
  return buckets.map((bucket) => ({
    approved: bucket.approved,
    absent: bucket.absent,
    pending: bucket.pending,
    rejected: bucket.rejected,
    incomplete: bucket.incomplete,
    label: bucket.label,
    title: granularity === "day" ? formatDate(bucket.key, "long") : bucket.label,
  }));
}

export function AttendanceTrendChart({
  data,
  height = 280,
  ariaLabel,
}: {
  data: TrendDatum[];
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={CHART_THEME.grid} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: CHART_THEME.axis }}
            tick={AXIS_TICK}
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} />
          <Tooltip
            cursor={{ fill: CHART_THEME.cursor }}
            content={
              <ChartTooltip
                title={(_, items) => String(items[0]?.payload?.title ?? "")}
                colors={STATUS_COLORS}
                names={STATUS_NAMES}
                showTotal
                reverse
                hideZero
              />
            }
          />
          {CHART_STATUS_ORDER.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="attendance"
              fill={CHART_STATUS_META[status].color}
              maxBarSize={24}
              isAnimationActive={false}
              shape={COLUMN_SEGMENT}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------- donut ----------------------------------- */

export interface DistributionDatum {
  status: ChartStatus;
  count: number;
}

export function StatusDonutChart({
  data,
  centerLabel = "records",
  size = 188,
}: {
  data: DistributionDatum[];
  centerLabel?: string;
  size?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  // Zero-width slices only add rendering artifacts; they still appear in the legend.
  const plotted = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      status: item.status,
      name: CHART_STATUS_META[item.status].label,
      count: item.count,
      fill: CHART_STATUS_META[item.status].color,
    }));

  return (
    <div
      role="img"
      aria-label={`Attendance by status: ${data.map((d) => `${CHART_STATUS_META[d.status].label} ${d.count}`).join(", ")}`}
      className="relative mx-auto shrink-0"
      style={{ width: size, height: size }}
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: size, height: size }}>
        <PieChart>
          <Pie
            data={plotted}
            dataKey="count"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={plotted.length > 1 ? 2 : 0}
            cornerRadius={3}
            stroke="none"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          />
          <Tooltip
            content={
              <ChartTooltip
                title={(_, items) => String(items[0]?.name ?? "")}
                format={(value) => `${formatNumber(value)} ${value === 1 ? "record" : "records"}`}
              />
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl leading-7 font-semibold text-foreground">{formatNumber(total)}</p>
          <p className="text-xs text-muted-foreground">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}

/** Legend for the donut: the figures live here too, so nothing depends on hover. */
export function StatusBreakdown({ data }: { data: DistributionDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <ul className="w-full space-y-2.5" aria-label="Attendance by status">
      {data.map((item) => {
        const meta = CHART_STATUS_META[item.status];
        const share = total ? (item.count / total) * 100 : 0;
        return (
          <li key={item.status} className="flex items-center gap-3 text-sm">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: meta.color }} aria-hidden />
            <span className="flex-1 text-muted-foreground">{meta.label}</span>
            <span className="font-semibold text-foreground tabular-nums">{formatNumber(item.count)}</span>
            <span className="w-11 text-right text-xs text-muted-foreground tabular-nums">{share.toFixed(0)}%</span>
          </li>
        );
      })}
    </ul>
  );
}
