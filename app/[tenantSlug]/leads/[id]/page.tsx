import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { getAssignableLeadOwnerOptions, type LeadOwnerMembership } from '@/lib/lead-owner';
import { canAssignLeads, canEditLead, canResolveReassignment } from '@/lib/lead-permissions';
import {
  getLeadStatusVariant,
  getReassignmentStatusVariant,
  LEAD_STATUS_LABEL,
  REASSIGNMENT_STATUS_LABEL,
} from '@/lib/lead-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadFormDialog } from '../components/lead-form-dialog';
import { ReassignRequestDialog } from '../components/reassign-request-dialog';
import { ResolveReassignmentDialog } from '../components/resolve-reassignment-dialog';

function formatDate(value: Date) {
  return value.toLocaleString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = await params;
  const { tenant, membership, session } = await requireTenantFeature(tenantSlug, 'CRM_LEADS');

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
    isActiveMember: session.user.isSuperAdmin || Boolean(membership?.isActive),
  };

  const assignmentsEnabled = await isTenantFeatureEnabled(tenant.id, 'ASSIGNMENTS');

  const activeOwnersPromise: Promise<LeadOwnerMembership[]> = assignmentsEnabled
    ? db.membership.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          isActive: true,
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      })
    : Promise.resolve([]);

  const [lead, activeOwners] = await Promise.all([
    db.lead.findFirst({
      where: { id, tenantId: tenant.id, deletedAt: null },
      select: {
        id: true,
        businessName: true,
        ruc: true,
        status: true,
        country: true,
        city: true,
        industry: true,
        source: true,
        notes: true,
        phones: true,
        emails: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true } },
        reassignmentRequests: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            reason: true,
            resolutionNote: true,
            createdAt: true,
            resolvedAt: true,
            requestedOwnerId: true,
            requestedBy: { select: { name: true, email: true } },
            requestedOwner: { select: { name: true, email: true } },
            resolvedBy: { select: { name: true, email: true } },
          },
        },
      },
    }),
    activeOwnersPromise,
  ]);

  if (!lead) {
    notFound();
  }

  const assignableOwners = getAssignableLeadOwnerOptions(activeOwners);
  const canAssign = assignmentsEnabled && canAssignLeads(actor);
  const canResolve = assignmentsEnabled && canResolveReassignment(actor);
  const canEdit = canEditLead(actor, { ownerId: lead.ownerId });

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getLeadStatusVariant(lead.status)}>
              {LEAD_STATUS_LABEL[lead.status]}
            </Badge>
            {lead.owner ? (
              <Badge variant="secondary">Owner: {lead.owner.name || lead.owner.email}</Badge>
            ) : (
              <Badge variant="outline">Sin owner</Badge>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{lead.businessName}</h1>
            <p className="text-muted-foreground">
              Vista operacional del lead, su owner y el historial de reasignaciones.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${tenantSlug}/leads`}>Volver a leads</Link>
          </Button>

          {canEdit && (
            <LeadFormDialog
              tenantSlug={tenantSlug}
              owners={assignableOwners}
              canAssign={canAssign}
              lead={lead}
              trigger={<Button type="button">Editar lead</Button>}
            />
          )}

          {!canEdit && assignmentsEnabled && lead.ownerId && assignableOwners.length > 0 && (
            <ReassignRequestDialog
              tenantSlug={tenantSlug}
              leadId={lead.id}
              owners={assignableOwners}
              trigger={<Button type="button">Solicitar reasignación</Button>}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{LEAD_STATUS_LABEL[lead.status]}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Owner actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {lead.owner?.name || lead.owner?.email || 'Sin owner'}
            </p>
            {lead.owner && <p className="text-sm text-muted-foreground">{lead.owner.email}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Origen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lead.source || '—'}</p>
            <p className="text-sm text-muted-foreground">
              {lead.city || lead.country || 'Ubicación no registrada'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actualización
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold">{formatDate(lead.updatedAt)}</p>
            <p className="text-sm text-muted-foreground">Creado: {formatDate(lead.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos comerciales</CardTitle>
              <CardDescription>
                Información principal del prospecto y su contexto de negocio.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Razón social
                </p>
                <p className="font-medium">{lead.businessName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">RUC</p>
                <p className="font-medium">{lead.ruc || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rubro</p>
                <p className="font-medium">{lead.industry || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ubicación</p>
                <p className="font-medium">
                  {[lead.city, lead.country].filter(Boolean).join(', ') || 'No registrada'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contacto</CardTitle>
              <CardDescription>Canales disponibles para contactar al prospecto.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Teléfonos</p>
                {lead.phones.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {lead.phones.map((phone) => (
                      <li key={phone}>{phone}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin teléfonos registrados.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Emails</p>
                {lead.emails.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {lead.emails.map((email) => (
                      <li key={email}>{email}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin emails registrados.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas comerciales</CardTitle>
              <CardDescription>
                Observaciones de negocio, acuerdos y contexto operativo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lead.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-6">{lead.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay notas registradas para este lead.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Historial de reasignaciones</CardTitle>
              <CardDescription>
                Seguimiento de solicitudes, aprobaciones y rechazos alrededor del ownership.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lead.reassignmentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este lead no tiene solicitudes de reasignación todavía.
                </p>
              ) : (
                <div className="space-y-4">
                  {lead.reassignmentRequests.map((request) => (
                    <div key={request.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={getReassignmentStatusVariant(request.status)}>
                          {REASSIGNMENT_STATUS_LABEL[request.status]}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(request.createdAt)}
                        </p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Solicitado por:</span>{' '}
                          {request.requestedBy.name || request.requestedBy.email}
                        </p>
                        <p>
                          <span className="font-medium">Owner sugerido:</span>{' '}
                          {request.requestedOwner
                            ? request.requestedOwner.name || request.requestedOwner.email
                            : 'Sin sugerencia'}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{request.reason}</p>
                      </div>

                      {request.resolutionNote && (
                        <div className="rounded-md bg-muted/50 p-3 text-sm">
                          <p className="font-medium">Nota de resolución</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {request.resolutionNote}
                          </p>
                        </div>
                      )}

                      {request.resolvedAt && (
                        <p className="text-xs text-muted-foreground">
                          Resuelto por{' '}
                          {request.resolvedBy?.name || request.resolvedBy?.email || '—'} el{' '}
                          {formatDate(request.resolvedAt)}
                        </p>
                      )}

                      {canResolve &&
                        request.status === 'PENDING' &&
                        assignableOwners.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <ResolveReassignmentDialog
                              tenantSlug={tenantSlug}
                              requestId={request.id}
                              status="APPROVED"
                              owners={assignableOwners}
                              defaultOwnerId={request.requestedOwnerId}
                              trigger={
                                <Button type="button" size="sm" variant="secondary">
                                  Aprobar
                                </Button>
                              }
                            />
                            <ResolveReassignmentDialog
                              tenantSlug={tenantSlug}
                              requestId={request.id}
                              status="REJECTED"
                              owners={assignableOwners}
                              trigger={
                                <Button type="button" size="sm" variant="destructive">
                                  Rechazar
                                </Button>
                              }
                            />
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
