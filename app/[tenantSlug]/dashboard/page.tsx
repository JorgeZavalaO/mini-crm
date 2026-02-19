import { requireTenantAccess } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant, membership, session } = await requireTenantAccess(tenantSlug);

  const [leads, members] = await Promise.all([
    db.lead.count({ where: { tenantId: tenant.id } }),
    db.membership.count({ where: { tenantId: tenant.id, isActive: true } }),
  ]);

  const displayRole = membership?.role ?? (session.user.isSuperAdmin ? 'SUPERADMIN' : '—');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{leads}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Miembros del equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{members}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tu rol</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{displayRole}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
