'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  Bell,
  CheckCircle2,
  FileText,
  Inbox,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Shuffle,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { getTenantNotificationsAction, type NotificationItem } from '@/lib/notifications-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

const TYPE_CONFIG: Record<
  NotificationItem['type'],
  { icon: React.ElementType; color: string; bg: string }
> = {
  UNASSIGNED_LEAD: {
    icon: Inbox,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
  },
  LEAD_NEW: {
    icon: CheckCircle2,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-100 dark:bg-sky-900/40',
  },
  LEAD_WON: {
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  QUOTE_CREATED: {
    icon: FileText,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-900/40',
  },
  QUOTE_ACCEPTED: {
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  QUOTE_REJECTED: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/40',
  },
  PENDING_REASSIGNMENT: {
    icon: Shuffle,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
  },
};

type Props = {
  tenantSlug: string;
};

export function NotificationsBell({ tenantSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await getTenantNotificationsAction(tenantSlug);
        setItems(result);
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    });
  }, [tenantSlug]);

  // Carga inicial al montar
  useEffect(() => {
    load();
  }, [load]);

  // Recarga al abrir el popover
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const urgentCount = items.filter(
    (n) => n.type === 'UNASSIGNED_LEAD' || n.type === 'PENDING_REASSIGNMENT',
  ).length;

  const badgeCount = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label={`Notificaciones${badgeCount > 0 ? ` (${badgeCount})` : ''}`}
        >
          <Bell className="size-5" />
          {badgeCount > 0 && (
            <span
              className={`absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                urgentCount > 0 ? 'bg-red-500' : 'bg-primary'
              }`}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        {/* Encabezado */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notificaciones</span>
            {badgeCount > 0 && (
              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-xs">
                {badgeCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={load}
            disabled={isPending}
            aria-label="Actualizar notificaciones"
          >
            <RefreshCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <Separator />

        {/* Lista */}
        {!loaded || isPending ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <ShieldAlert className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Sin notificaciones pendientes</p>
          </div>
        ) : (
          <ScrollArea className="h-[420px]">
            <ul className="divide-y">
              {items.map((item) => {
                const cfg = TYPE_CONFIG[item.type];
                const Icon = cfg.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      {/* Icono */}
                      <span
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}
                      >
                        <Icon className={`size-4 ${cfg.color}`} />
                      </span>

                      {/* Texto */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/60">
                          {timeAgo(item.createdAt)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        {/* Pie: grupos urgentes */}
        {urgentCount > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2.5">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ {urgentCount} elemento{urgentCount > 1 ? 's' : ''} requiere
                {urgentCount > 1 ? 'n' : ''} atención inmediata
              </p>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
