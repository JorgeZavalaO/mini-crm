import { requireTenantRole } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { hasRole } from '@/lib/rbac';
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
import { RemoveMemberButton } from './remove-member-button';
import { ToggleMemberButton } from './toggle-member-button';

export default async function TeamPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant, session, membership } = await requireTenantRole(tenantSlug, 'SUPERVISOR');

  const members = await db.membership.findMany({
    where: { tenantId: tenant.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const canManage = session.user.isSuperAdmin || hasRole(membership?.role, 'ADMIN');

  return (
    <div className="min-w-0 space-y-6">
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

      {!canManage && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Puedes consultar el equipo, pero solo un administrador puede crear, activar o desactivar
          miembros.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
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
                <TableCell className="font-medium">
                  {m.user.name ?? '—'}
                  {m.user.id === session.user.id && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(Tú)</span>
                  )}
                </TableCell>
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
                  {canManage ? (
                    <div className="flex justify-end gap-2">
                      {m.user.id === session.user.id && !session.user.isSuperAdmin ? (
                        <span className="text-sm text-muted-foreground">Tu cuenta</span>
                      ) : (
                        <>
                          <ToggleMemberButton
                            membershipId={m.id}
                            isActive={m.isActive}
                            tenantSlug={tenantSlug}
                          />
                          <RemoveMemberButton
                            membershipId={m.id}
                            tenantSlug={tenantSlug}
                            memberName={m.user.name ?? m.user.email}
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin permisos</span>
                  )}
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
