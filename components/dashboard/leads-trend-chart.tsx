'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';

const chartConfig = {
  leads: { label: 'Leads nuevos', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

export type MonthlyDataPoint = { month: string; leads: number };

export function LeadsTrendChart({
  data,
  lastUpdated = new Date(),
}: {
  data: MonthlyDataPoint[];
  lastUpdated?: Date;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  const formattedTime = lastUpdated.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const formattedDate = lastUpdated.toLocaleDateString('es-PE', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          Datos a:{' '}
          <span className="font-medium">
            {formattedDate} · {formattedTime}
          </span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
          className="h-8 w-8 p-0 hover:bg-muted"
          title="Actualizar gráfico"
        >
          <RotateCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <AreaChart data={data} margin={{ top: 4, right: 24, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            interval={0}
            tickFormatter={(value: string) => {
              // "octubre de 2025" → "Oct 25"
              const parts = value.split(' ');
              const month = parts[0] ?? value;
              const year = parts[2] ?? '';
              const abbr = month.slice(0, 3);
              return `${abbr.charAt(0).toUpperCase()}${abbr.slice(1)} ${year.slice(2)}`;
            }}
          />
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
    </div>
  );
}
