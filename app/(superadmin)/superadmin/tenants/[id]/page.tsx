import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-guard';
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
import { ToggleTenantButton } from '../../toggle-tenant-button';
import { notFound } from 'next/navigation';

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSuperAdmin();

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { leads: true } },
    },
  });

  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href="/superadmin">← Volver</Link>
        </Button>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <Badge variant={tenant.isActive ? 'default' : 'destructive'}>
            {tenant.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
        <p className="text-muted-foreground">/{tenant.slug}</p>
      </div>

      {/* ── Actions ────────────────────────────────── */}
      <div className="flex gap-3">
        <Button asChild>
          <Link href={`/${tenant.slug}/dashboard`}>Impersonar →</Link>
        </Button>
        <ToggleTenantButton tenantId={tenant.id} isActive={tenant.isActive} />
      </div>

      {/* ── Stats ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Miembros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tenant.memberships.length}</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Slug</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-mono">{tenant.slug}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Members table ──────────────────────────── */}
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
                  <TableCell>{m.user.name ?? '—'}</TableCell>
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
