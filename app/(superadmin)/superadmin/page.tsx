import Link from 'next/link';
import { db } from '@/lib/db';
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
import { ToggleTenantButton } from './toggle-tenant-button';
import { CreateTenantDialog } from '@/components/superadmin/create-tenant-dialog';
import { TenantLifecycleButton } from '@/components/superadmin/tenant-lifecycle-button';

export default async function SuperadminPage() {
  const [tenantCount, userCount, leadCount, plans, tenants] = await Promise.all([
    db.tenant.count({ where: { deletedAt: null } }),
    db.user.count(),
    db.lead.count(),
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
    db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { select: { name: true } },
        memberships: { where: { isActive: true }, select: { id: true } },
        _count: { select: { leads: true } },
      },
    }),
  ]);

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Panel Super Admin</h1>
        <p className="text-muted-foreground">Centro de control de tenants, planes y modulos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tenants activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tenantCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{userCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads (global)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{leadCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Empresas</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/superadmin/plans">Planes</Link>
            </Button>
            <CreateTenantDialog plans={plans} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Limites</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Usuarios</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => {
                const stateLabel = t.deletedAt ? 'Baja' : t.isActive ? 'Activo' : 'Inactivo';
                const stateVariant = t.deletedAt
                  ? 'destructive'
                  : t.isActive
                    ? 'default'
                    : 'outline';
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                    <TableCell>{t.plan?.name ?? '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.maxUsers ?? '-'} usr / {t.maxStorageGb ?? '-'} GB /{' '}
                      {t.retentionDays ?? '-'} d
                    </TableCell>
                    <TableCell>
                      <Badge variant={stateVariant}>{stateLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{t.memberships.length}</TableCell>
                    <TableCell className="text-center">{t._count.leads}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`/${t.slug}/dashboard`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Impersonar
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/superadmin/tenants/${t.id}`}>Detalle</Link>
                        </Button>
                        {!t.deletedAt && (
                          <ToggleTenantButton tenantId={t.id} isActive={t.isActive} />
                        )}
                        <TenantLifecycleButton tenantId={t.id} isDeleted={Boolean(t.deletedAt)} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No hay empresas registradas aun.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
