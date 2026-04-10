import Link from 'next/link';
import { requireTenantRole } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/date-utils';
import { buildSearchHref, firstSearchParam, getPaginationState } from '@/lib/pagination';
import { mapTeamInvitationListItem } from '@/lib/team-invite-service';
import { hasRole } from '@/lib/rbac';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListPagination } from '@/components/ui/list-pagination';
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

function parsePage(value: string | string[] | undefined) {
  const raw = firstSearchParam(value);
  const numeric = Number(raw ?? '1');

  if (!Number.isFinite(numeric) || numeric < 1) {
    return 1;
  }

  return Math.floor(numeric);
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const [{ tenant, session, membership }, rawSearchParams] = await Promise.all([
    requireTenantRole(tenantSlug, 'SUPERVISOR'),
    searchParams,
  ]);

  const membersPage = parsePage(rawSearchParams.membersPage);
  const invitesPage = parsePage(rawSearchParams.invitesPage);
  const membersPageSize = 10;
  const invitesPageSize = 10;
  const now = new Date();

  const canManage = session.user.isSuperAdmin || hasRole(membership?.role, 'ADMIN');
  const invitationsWhere = {
    tenantId: tenant.id,
    acceptedAt: null,
    canceledAt: null,
  };

  const [memberTotal, invitationTotal] = await Promise.all([
    db.membership.count({ where: { tenantId: tenant.id } }),
    canManage ? db.teamInvitation.count({ where: invitationsWhere }) : Promise.resolve(0),
  ]);

  const membersPagination = getPaginationState({
    totalItems: memberTotal,
    page: membersPage,
    pageSize: membersPageSize,
  });
  const invitesPagination = getPaginationState({
    totalItems: invitationTotal,
    page: invitesPage,
    pageSize: invitesPageSize,
  });

  const [members, invitations, pendingInvitations, expiredInvitations] = await Promise.all([
    db.membership.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: membersPagination.skip,
      take: membersPageSize,
    }),
    canManage
      ? db.teamInvitation.findMany({
          where: invitationsWhere,
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
          skip: invitesPagination.skip,
          take: invitesPageSize,
        })
      : Promise.resolve([]),
    canManage
      ? db.teamInvitation.count({
          where: { ...invitationsWhere, expiresAt: { gt: now } },
        })
      : Promise.resolve(0),
    canManage
      ? db.teamInvitation.count({
          where: { ...invitationsWhere, expiresAt: { lte: now } },
        })
      : Promise.resolve(0),
  ]);

  const invitationRows = invitations.map(mapTeamInvitationListItem);

  const membersPageHref = (page: number) =>
    buildSearchHref({ invitesPage: invitesPagination.currentPage }, { membersPage: page });

  const invitesPageHref = (page: number) =>
    buildSearchHref({ membersPage: membersPagination.currentPage }, { invitesPage: page });

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

      <ListPagination
        currentPage={membersPagination.currentPage}
        totalPages={membersPagination.totalPages}
        totalItems={memberTotal}
        startItem={membersPagination.startItem}
        endItem={membersPagination.endItem}
        hrefForPage={membersPageHref}
      />

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
                      {formatDateTime(invite.createdAt, tenant.companyTimezone)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(invite.expiresAt, tenant.companyTimezone)}
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

          <ListPagination
            currentPage={invitesPagination.currentPage}
            totalPages={invitesPagination.totalPages}
            totalItems={invitationTotal}
            startItem={invitesPagination.startItem}
            endItem={invitesPagination.endItem}
            hrefForPage={invitesPageHref}
          />
        </div>
      )}
    </div>
  );
}
