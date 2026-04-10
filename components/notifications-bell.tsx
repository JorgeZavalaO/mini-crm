'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  Inbox,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Shuffle,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  getTenantNotificationsAction,
  getUnreadCountAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationItem,
} from '@/lib/notifications-actions';
import { formatRelativeTime } from '@/lib/date-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
  TASK_ASSIGNED: {
    icon: ClipboardList,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-900/40',
  },
};

type Props = {
  tenantSlug: string;
};

export function NotificationsBell({ tenantSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadCount = useCallback(() => {
    startTransition(async () => {
      try {
        const count = await getUnreadCountAction(tenantSlug);
        setUnreadCount(count);
      } catch {
        /* ignore */
      }
    });
  }, [tenantSlug]);

  const loadItems = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await getTenantNotificationsAction(tenantSlug);
        setItems(result);
        setUnreadCount(result.filter((n) => !n.isRead).length);
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    });
  }, [tenantSlug]);

  // Carga inicial: solo el conteo
  useEffect(() => {
    loadCount();
  }, [loadCount]);

  // Recarga items al abrir el popover
  useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  const handleMarkRead = useCallback(
    (notificationId: string) => {
      startTransition(async () => {
        try {
          await markNotificationReadAction({ tenantSlug, notificationId });
          setItems((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
          );
          setUnreadCount((c) => Math.max(0, c - 1));
        } catch {
          /* ignore */
        }
      });
    },
    [tenantSlug],
  );

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction(tenantSlug);
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      } catch {
        /* ignore */
      }
    });
  }, [tenantSlug]);

  const urgentCount = items.filter(
    (n) => !n.isRead && (n.type === 'UNASSIGNED_LEAD' || n.type === 'PENDING_REASSIGNMENT'),
  ).length;

  const badgeCount = unreadCount;

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
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleMarkAllRead}
                disabled={isPending}
                aria-label="Marcar todas como leídas"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={loadItems}
              disabled={isPending}
              aria-label="Actualizar notificaciones"
            >
              <RefreshCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
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
          <ScrollArea className="h-105">
            <ul className="divide-y">
              {items.map((item) => {
                const cfg = TYPE_CONFIG[item.type];
                const Icon = cfg.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (!item.isRead) handleMarkRead(item.id);
                        setOpen(false);
                      }}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                        !item.isRead ? 'bg-muted/30' : ''
                      }`}
                    >
                      {/* Indicador no leída */}
                      <span className="mt-3 flex size-2 shrink-0">
                        {!item.isRead && <span className="size-2 rounded-full bg-primary" />}
                      </span>

                      {/* Icono */}
                      <span
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}
                      >
                        <Icon className={`size-4 ${cfg.color}`} />
                      </span>

                      {/* Texto */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm leading-tight ${!item.isRead ? 'font-semibold' : 'font-medium text-muted-foreground'}`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/60">
                          {formatRelativeTime(item.createdAt)}
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

        {/* Ver todas */}
        {items.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2.5 text-center">
              <Link
                href={`/${tenantSlug}/notifications`}
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver todas las notificaciones →
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
