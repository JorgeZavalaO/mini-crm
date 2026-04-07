import { ArrowRight, UserCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LeadOwnerHistoryRow } from '@/lib/lead-actions';

function formatRelative(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');
  return rtf.format(diffYear, 'year');
}

function formatAbsolute(date: Date): string {
  return date.toLocaleString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function OwnerLabel({
  owner,
  fallback,
}: {
  owner: { name: string | null; email: string } | null;
  fallback: string;
}) {
  if (!owner) {
    return <span className="italic text-muted-foreground">{fallback}</span>;
  }
  const display = owner.name || owner.email;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar className="h-5 w-5">
        <AvatarFallback className="text-[9px]">{getInitials(display)}</AvatarFallback>
      </Avatar>
      <span className="font-medium">{display}</span>
    </span>
  );
}

type OwnerHistoryTimelineProps = {
  items: LeadOwnerHistoryRow[];
};

export function OwnerHistoryTimeline({ items }: OwnerHistoryTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
        <UserCheck className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Sin cambios de responsable registrados.</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-border">
      {items.map((item) => (
        <li key={item.id} className="pb-6 pl-6 last:pb-0">
          {/* dot */}
          <span className="absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary/80">
            <UserCheck className="size-2.5 text-primary-foreground" />
          </span>

          <div className="space-y-1.5">
            {/* from → to */}
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <OwnerLabel owner={item.previousOwner} fallback="Sin responsable" />
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              <OwnerLabel owner={item.newOwner} fallback="Sin responsable" />
              {item.reassignmentRequestId && (
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                  vía solicitud
                </Badge>
              )}
            </div>

            {/* meta */}
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>
                Cambiado por{' '}
                <span className="font-medium text-foreground">
                  {item.changedBy.name || item.changedBy.email}
                </span>
              </span>
              <span aria-hidden>·</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <time dateTime={item.createdAt.toISOString()} className="cursor-default">
                    {formatRelative(item.createdAt)}
                  </time>
                </TooltipTrigger>
                <TooltipContent side="bottom">{formatAbsolute(item.createdAt)}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
