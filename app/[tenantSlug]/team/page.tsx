import { requireTenantRole } from '@/lib/auth-guard';
import { db } from '@/lib/db';
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
import { ToggleMemberButton } from './toggle-member-button';

export default async function TeamPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant, session } = await requireTenantRole(tenantSlug, 'SUPERVISOR');

  const members = await db.membership.findMany({
    where: { tenantId: tenant.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const canManage = session.user.isSuperAdmin || true; // Already validated as SUPERVISOR+

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipo</h1>
          <p className="text-muted-foreground">Gestiona los miembros de {tenant.name}</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href={`/${tenantSlug}/team/new`}>+ Nuevo miembro</Link>
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.user.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{m.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={m.isActive ? 'default' : 'destructive'}>
                    {m.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ToggleMemberButton
                    membershipId={m.id}
                    isActive={m.isActive}
                    tenantSlug={tenantSlug}
                  />
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No hay miembros aún.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
