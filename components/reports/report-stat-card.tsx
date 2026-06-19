import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Delta } from '@/lib/reporting/shared';

const TONE_CLASS = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
} as const;

const DELTA_TONE_CLASS = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-rose-600 dark:text-rose-400',
  flat: 'text-muted-foreground',
} as const;

function formatDelta(delta: Delta) {
  if (delta.percent === null) {
    return delta.previous === 0 && delta.current === 0 ? 'Sin cambio' : 'Nuevo';
  }
  const sign = delta.percent > 0 ? '+' : '';
  return `${sign}${delta.percent}%`;
}

function DeltaBadge({ delta }: { delta: Delta }) {
  const Icon =
    delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium',
        DELTA_TONE_CLASS[delta.direction],
      )}
      title={`Período anterior: ${delta.previous.toLocaleString('es-PE')}`}
    >
      <Icon className="h-3 w-3" />
      {formatDelta(delta)}
    </span>
  );
}

export function ReportStatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'default',
  delta,
  scopeLabel,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASS;
  delta?: Delta;
  scopeLabel?: 'Periodo' | 'Estado actual';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {scopeLabel && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {scopeLabel}
            </p>
          )}
        </div>
        <div
          className={cn('flex h-9 w-9 items-center justify-center rounded-lg', TONE_CLASS[tone])}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {delta && <DeltaBadge delta={delta} />}
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
