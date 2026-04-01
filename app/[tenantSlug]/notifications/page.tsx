import { Bell } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import {
  getUnreadCountAction,
  listTenantNotificationsPageAction,
} from '@/lib/notifications-actions';
import { firstSearchParam, getPaginationState } from '@/lib/pagination';
import { notificationFiltersSchema } from '@/lib/validators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationsFullList } from '@/components/notifications/notifications-full-list';

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  await requireTenantFeature(tenantSlug, 'NOTIFICATIONS');
  const rawSearchParams = await searchParams;

  const filterParam = firstSearchParam(rawSearchParams.filter);
  const parsedFilters = notificationFiltersSchema.safeParse({
    tenantSlug,
    isRead: filterParam === 'unread' ? false : filterParam === 'read' ? true : undefined,
    page: firstSearchParam(rawSearchParams.page) ?? '1',
    pageSize: firstSearchParam(rawSearchParams.pageSize) ?? '20',
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : notificationFiltersSchema.parse({ tenantSlug, page: 1, pageSize: 20 });

  const [notificationsResult, unreadCount] = await Promise.all([
    listTenantNotificationsPageAction(filters).catch(() => ({ items: [], total: 0 })),
    getUnreadCountAction(tenantSlug).catch(() => 0),
  ]);

  const pagination = getPaginationState({
    totalItems: notificationsResult.total,
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const activeFilter = filterParam === 'read' || filterParam === 'unread' ? filterParam : 'all';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="size-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationsFullList
            tenantSlug={tenantSlug}
            initialItems={notificationsResult.items}
            initialFilter={activeFilter}
            initialUnreadCount={unreadCount}
            pagination={{
              currentPage: pagination.currentPage,
              totalPages: pagination.totalPages,
              totalItems: notificationsResult.total,
              startItem: pagination.startItem,
              endItem: pagination.endItem,
            }}
            pageSize={filters.pageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
