import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE_CLASS = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
} as const;

export function ReportStatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'default',
}: {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div
          className={cn('flex h-9 w-9 items-center justify-center rounded-lg', TONE_CLASS[tone])}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
