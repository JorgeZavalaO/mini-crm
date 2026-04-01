import { Bell } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationsFullList } from '@/components/notifications/notifications-full-list';

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireTenantFeature(tenantSlug, 'NOTIFICATIONS');

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
          <NotificationsFullList tenantSlug={tenantSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
