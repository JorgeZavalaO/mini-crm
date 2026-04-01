'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  FileText,
  Inbox,
  Loader2,
  Shuffle,
  Trash2,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationItem,
} from '@/lib/notifications-actions';
import { buildSearchHref } from '@/lib/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListPagination } from '@/components/ui/list-pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

type Filter = 'all' | 'unread' | 'read';

type PaginationMeta = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
};

type Props = {
  tenantSlug: string;
  initialItems: NotificationItem[];
  initialFilter: Filter;
  initialUnreadCount: number;
  pagination: PaginationMeta;
  pageSize: number;
};

export function NotificationsFullList({
  tenantSlug,
  initialItems,
  initialFilter,
  initialUnreadCount,
  pagination,
  pageSize,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();

  const pageHref = useCallback(
    (page: number) => buildSearchHref({ filter: initialFilter, pageSize }, { page }),
    [initialFilter, pageSize],
  );

  const filterHref = useCallback(
    (filter: Filter) => buildSearchHref({ pageSize }, { filter, page: 1 }),
    [pageSize],
  );

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  const handleMarkRead = useCallback(
    (notificationId: string) => {
      startTransition(async () => {
        try {
          await markNotificationReadAction({ tenantSlug, notificationId });
          setItems((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
          router.refresh();
        } catch {
          /* ignore */
        }
      });
    },
    [router, tenantSlug],
  );

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction(tenantSlug);
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        router.refresh();
      } catch {
        /* ignore */
      }
    });
  }, [router, tenantSlug]);

  const handleDelete = useCallback(
    (notificationId: string) => {
      startTransition(async () => {
        try {
          await deleteNotificationAction({ tenantSlug, notificationId });
          setItems((prev) => {
            const target = prev.find((item) => item.id === notificationId);
            if (target && !target.isRead) {
              setUnreadCount((count) => Math.max(0, count - 1));
            }

            return prev.filter((n) => n.id !== notificationId);
          });
          router.refresh();
        } catch {
          /* ignore */
        }
      });
    },
    [router, tenantSlug],
  );

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={initialFilter} onValueChange={(v) => router.push(filterHref(v as Filter))}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="unread">
              No leídas
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 rounded-full px-1.5 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read">Leídas</TabsTrigger>
          </TabsList>
        </Tabs>

        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isPending}>
            <CheckCheck className="mr-1.5 size-4" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {/* Lista */}
      {isPending && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Bell className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {initialFilter === 'unread'
              ? 'No hay notificaciones sin leer'
              : initialFilter === 'read'
                ? 'No hay notificaciones leídas'
                : 'Sin notificaciones'}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((item) => {
            const cfg = TYPE_CONFIG[item.type];
            const Icon = cfg.icon;
            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 px-4 py-3 ${!item.isRead ? 'bg-muted/30' : ''}`}
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

                {/* Contenido */}
                <Link
                  href={item.href}
                  className="min-w-0 flex-1 hover:underline"
                  onClick={() => {
                    if (!item.isRead) handleMarkRead(item.id);
                  }}
                >
                  <p
                    className={`truncate text-sm leading-tight ${!item.isRead ? 'font-semibold' : 'font-medium text-muted-foreground'}`}
                  >
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    {timeAgo(item.createdAt)}
                  </p>
                </Link>

                {/* Acciones */}
                <div className="flex shrink-0 gap-1">
                  {!item.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleMarkRead(item.id)}
                      disabled={isPending}
                      title="Marcar como leída"
                    >
                      <CheckCircle2 className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                    title="Eliminar"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ListPagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        hrefForPage={pageHref}
      />
    </div>
  );
}
