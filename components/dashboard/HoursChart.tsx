"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK } from "@/components/dashboard/AttendanceChart";
import { ChartTooltip } from "@/components/dashboard/ChartTooltip";
import { CHART_THEME } from "@/lib/status-config";

export interface HoursDatum {
  label: string;
  title: string;
  hours: number;
}

/**
 * Hours per day against the daily requirement. One series, so one color and
 * no legend; the reference line is labelled directly.
 */
export function HoursChart({
  data,
  requiredHours,
  height = 240,
}: {
  data: HoursDatum[];
  requiredHours: number;
  height?: number;
}) {
  const highest = Math.max(requiredHours, ...data.map((d) => d.hours));
  const ceiling = Math.ceil((highest + 1) / 2) * 2;

  return (
    <div role="img" aria-label="Hours worked per day compared with the daily requirement" style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height }}>
        <BarChart data={data} margin={{ top: 16, right: 76, bottom: 0, left: -18 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={CHART_THEME.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: CHART_THEME.axis }} tick={AXIS_TICK} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={44}
            domain={[0, ceiling]}
            tickFormatter={(value: number) => `${value}h`}
          />
          <ReferenceLine
            y={requiredHours}
            stroke={CHART_THEME.tick}
            strokeWidth={1}
            label={{ value: `${requiredHours}h required`, position: "right", fill: CHART_THEME.tick, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: CHART_THEME.cursor }}
            content={
              <ChartTooltip
                title={(_, items) => String(items[0]?.payload?.title ?? "")}
                names={{ hours: "Hours worked" }}
                colors={{ hours: CHART_THEME.accent }}
                format={(value) => `${value.toFixed(1)} h`}
              />
            }
          />
          <Bar
            dataKey="hours"
            fill={CHART_THEME.accent}
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
