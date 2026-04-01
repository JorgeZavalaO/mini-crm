import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-guard';
import { firstSearchParam, getPaginationState } from '@/lib/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleTenantButton } from '../../toggle-tenant-button';
import { TenantLifecycleButton } from '@/components/superadmin/tenant-lifecycle-button';
import { TenantSettingsTabs } from '@/components/superadmin/tenant-settings-tabs';

function parsePage(value: string | string[] | undefined) {
  const raw = firstSearchParam(value);
  const numeric = Number(raw ?? '1');

  if (!Number.isFinite(numeric) || numeric < 1) {
    return 1;
  }

  return Math.floor(numeric);
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, rawSearchParams] = await Promise.all([params, searchParams, requireSuperAdmin()]);
  const membershipPage = parsePage(rawSearchParams.membershipPage);
  const membershipPageSize = 10;

  const [tenant, plans, membershipTotal, activeMembershipCount] = await Promise.all([
    db.tenant.findUnique({
      where: { id },
      include: {
        plan: { select: { id: true, name: true } },
        features: {
          select: { featureKey: true, enabled: true, config: true },
          orderBy: { featureKey: 'asc' },
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
    db.membership.count({ where: { tenantId: id } }),
    db.membership.count({ where: { tenantId: id, isActive: true } }),
  ]);

  if (!tenant) notFound();

  const membershipPagination = getPaginationState({
    totalItems: membershipTotal,
    page: membershipPage,
    pageSize: membershipPageSize,
  });

  const memberships = await db.membership.findMany({
    where: { tenantId: id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
    skip: membershipPagination.skip,
    take: membershipPageSize,
  });

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
        memberships={memberships.map((m) => ({
          id: m.id,
          role: m.role,
          isActive: m.isActive,
          createdAt: m.createdAt,
          user: m.user,
        }))}
        membershipCounts={{
          total: membershipTotal,
          active: activeMembershipCount,
          inactive: membershipTotal - activeMembershipCount,
        }}
        membershipPagination={{
          currentPage: membershipPagination.currentPage,
          totalPages: membershipPagination.totalPages,
          totalItems: membershipTotal,
          startItem: membershipPagination.startItem,
          endItem: membershipPagination.endItem,
        }}
      />
    </div>
  );
}
