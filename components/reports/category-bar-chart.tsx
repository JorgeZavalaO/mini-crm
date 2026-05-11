'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { MetricDatum } from '@/lib/reporting/shared';

export function CategoryBarChart({
  data,
  seriesLabel = 'Valor',
  color = 'hsl(var(--chart-1))',
}: {
  data: MetricDatum[];
  seriesLabel?: string;
  color?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Sin datos para este gráfico.
      </div>
    );
  }

  const chartConfig = {
    value: { label: seriesLabel, color },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-60 w-full">
      <BarChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          interval={0}
          height={44}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
