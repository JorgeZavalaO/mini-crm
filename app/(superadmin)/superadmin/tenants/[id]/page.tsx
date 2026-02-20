import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleTenantButton } from '../../toggle-tenant-button';
import { TenantLifecycleButton } from '@/components/superadmin/tenant-lifecycle-button';
import { TenantSettingsTabs } from '@/components/superadmin/tenant-settings-tabs';

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSuperAdmin();

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
        _count: { select: { leads: true } },
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
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Miembros activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {tenant.memberships.filter((m) => m.isActive).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tenant._count.leads}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Limites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Usuarios: {tenant.maxUsers ?? '-'}</p>
            <p>Storage: {tenant.maxStorageGb ?? '-'} GB</p>
            <p>Retencion: {tenant.retentionDays ?? '-'} dias</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Miembros</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenant.memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.user.name ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.isActive ? 'default' : 'destructive'}>
                      {m.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
