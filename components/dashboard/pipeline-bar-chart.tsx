'use client';

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const BAR_COLORS: Record<string, string> = {
  NEW: 'var(--color-new)',
  CONTACTED: 'var(--color-contacted)',
  QUALIFIED: 'var(--color-qualified)',
  WON: 'var(--color-won)',
  LOST: 'var(--color-lost)',
};

const chartConfig = {
  count: { label: 'Leads' },
  new: { label: 'Nuevo', color: 'hsl(var(--chart-1))' },
  contacted: { label: 'Contactado', color: 'hsl(var(--chart-2))' },
  qualified: { label: 'Calificado', color: 'hsl(var(--chart-3))' },
  won: { label: 'Ganado', color: 'hsl(var(--chart-4))' },
  lost: { label: 'Perdido', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig;

type Bucket = { status: string; label: string; count: number };

export function PipelineBarChart({ buckets }: { buckets: Bucket[] }) {
  const data = buckets.map((b) => ({
    label: b.label,
    status: b.status,
    count: b.count,
    fill: BAR_COLORS[b.status] ?? 'hsl(var(--chart-1))',
  }));

  return (
    <ChartContainer config={chartConfig} className="h-55 w-full">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
