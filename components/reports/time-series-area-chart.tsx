'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { MetricDatum } from '@/lib/reporting/shared';

export function TimeSeriesAreaChart({
  data,
  seriesLabel = 'Eventos',
  color = 'hsl(var(--chart-1))',
}: {
  data: MetricDatum[];
  seriesLabel?: string;
  color?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Sin datos en el rango seleccionado.
      </div>
    );
  }

  const chartConfig = {
    value: { label: seriesLabel, color },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-60 w-full">
      <AreaChart data={data} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="reportsAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={20}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="url(#reportsAreaGradient)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
