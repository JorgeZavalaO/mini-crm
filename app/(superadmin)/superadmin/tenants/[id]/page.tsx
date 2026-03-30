import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleTenantButton } from '../../toggle-tenant-button';
import { TenantLifecycleButton } from '@/components/superadmin/tenant-lifecycle-button';
import { TenantSettingsTabs } from '@/components/superadmin/tenant-settings-tabs';

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, requireSuperAdmin()]);

  const [tenant, plans] = await Promise.all([
    db.tenant.findUnique({
      where: { id },
      include: {
        plan: { select: { id: true, name: true } },
        features: {
          select: { featureKey: true, enabled: true, config: true },
          orderBy: { featureKey: 'asc' },
        },
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { leads: { where: { deletedAt: null } } } },
      },
    }),
    db.plan.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        maxUsers: true,
        maxStorageGb: true,
        retentionDays: true,
        isActive: true,
      },
    }),
  ]);

  if (!tenant) notFound();

  const stateLabel = tenant.deletedAt ? 'Baja' : tenant.isActive ? 'Activo' : 'Inactivo';
  const stateVariant = tenant.deletedAt ? 'destructive' : tenant.isActive ? 'default' : 'outline';

  return (
    <div className="space-y-6">
      <div>
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href="/superadmin">Volver</Link>
        </Button>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <Badge variant={stateVariant}>{stateLabel}</Badge>
          <Badge variant="outline">Plan: {tenant.plan?.name ?? 'Sin plan'}</Badge>
        </div>
        <p className="text-muted-foreground">/{tenant.slug}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!tenant.deletedAt && (
          <Button asChild>
            <Link href={`/${tenant.slug}/dashboard`}>Impersonar</Link>
          </Button>
        )}
        {!tenant.deletedAt && (
          <ToggleTenantButton tenantId={tenant.id} isActive={tenant.isActive} />
        )}
        <TenantLifecycleButton tenantId={tenant.id} isDeleted={Boolean(tenant.deletedAt)} />
      </div>

      <TenantSettingsTabs
        tenant={{
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          planId: tenant.planId,
          maxUsers: tenant.maxUsers,
          maxStorageGb: tenant.maxStorageGb,
          retentionDays: tenant.retentionDays,
        }}
        plans={plans}
        features={tenant.features}
        memberships={tenant.memberships.map((m) => ({
          id: m.id,
          role: m.role,
          isActive: m.isActive,
          createdAt: m.createdAt,
          user: m.user,
        }))}
      />
    </div>
  );
}
