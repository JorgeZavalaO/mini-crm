import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { ToggleTenantButton } from './toggle-tenant-button';

export default async function SuperadminPage() {
  const [tenantCount, userCount, leadCount] = await Promise.all([
    db.tenant.count(),
    db.user.count(),
    db.lead.count(),
  ]);

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { memberships: true, leads: true } },
    },
  });

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Panel Super Admin</h1>
        <p className="text-muted-foreground">Gestión global de la plataforma multi-tenant.</p>
      </div>

      {/* ── Stats ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tenants</CardTitle>
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

      {/* ── Tenant table ───────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Empresas</h2>
          <Button asChild>
            <Link href="/superadmin/tenants/new">+ Nueva empresa</Link>
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Usuarios</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? 'default' : 'destructive'}>
                      {t.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{t._count.memberships}</TableCell>
                  <TableCell className="text-center">{t._count.leads}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/${t.slug}/dashboard`} target="_blank" rel="noopener noreferrer">
                          Impersonar
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/superadmin/tenants/${t.id}`}>Detalle</Link>
                      </Button>
                      <ToggleTenantButton tenantId={t.id} isActive={t.isActive} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No hay empresas registradas aún.
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
