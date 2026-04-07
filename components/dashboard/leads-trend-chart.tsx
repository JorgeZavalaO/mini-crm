'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  leads: { label: 'Leads nuevos', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

export type MonthlyDataPoint = { month: string; leads: number };

export function LeadsTrendChart({ data }: { data: MonthlyDataPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-55 w-full">
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="leads"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          fill="url(#leadsGradient)"
          dot={{ r: 3, fill: 'hsl(var(--chart-1))' }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
