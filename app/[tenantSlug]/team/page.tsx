import Link from 'next/link';
import { requireTenantRole } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { mapTeamInvitationListItem } from '@/lib/team-invite-service';
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
import { CancelInviteButton } from './cancel-invite-button';
import { InviteLinkButton } from './invite-link-button';
import { RemoveMemberButton } from './remove-member-button';
import { ToggleMemberButton } from './toggle-member-button';

function invitationVariant(status: 'PENDING' | 'EXPIRED') {
  return status === 'PENDING' ? 'default' : 'outline';
}

function formatDate(value: Date) {
  return value.toLocaleString('es-PE', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function TeamPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant, session, membership } = await requireTenantRole(tenantSlug, 'SUPERVISOR');

  const canManage = session.user.isSuperAdmin || hasRole(membership?.role, 'ADMIN');
  const [members, invitations] = await Promise.all([
    db.membership.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    canManage
      ? db.teamInvitation.findMany({
          where: {
            tenantId: tenant.id,
            acceptedAt: null,
            canceledAt: null,
          },
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            createdAt: true,
            acceptedAt: true,
            canceledAt: true,
            invitedBy: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  const invitationRows = invitations.map(mapTeamInvitationListItem);
  const pendingInvitations = invitationRows.filter((invite) => invite.status === 'PENDING').length;
  const expiredInvitations = invitationRows.filter((invite) => invite.status === 'EXPIRED').length;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipo</h1>
          <p className="text-muted-foreground">
            Gestiona miembros, invitaciones y onboarding de {tenant.name}
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href={`/${tenantSlug}/team/new`}>+ Invitar miembro</Link>
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

      {canManage && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Invitaciones abiertas</h2>
              <p className="text-sm text-muted-foreground">
                {pendingInvitations} pendiente(s) y {expiredInvitations} expirada(s). Las expiradas
                ya no reservan cupo y pueden regenerarse.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Invitado por</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitationRows.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invite.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={invitationVariant(invite.status as 'PENDING' | 'EXPIRED')}>
                        {invite.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>{invite.invitedBy.name || invite.invitedBy.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(invite.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(invite.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <InviteLinkButton
                          invitationId={invite.id}
                          tenantSlug={tenantSlug}
                          label={invite.status === 'EXPIRED' ? 'Renovar enlace' : 'Copiar enlace'}
                          variant="ghost"
                          size="sm"
                        />
                        {invite.status === 'PENDING' && (
                          <CancelInviteButton
                            invitationId={invite.id}
                            tenantSlug={tenantSlug}
                            inviteEmail={invite.email}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {invitationRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No hay invitaciones abiertas en este momento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
