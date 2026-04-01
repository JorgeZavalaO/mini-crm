import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Clock,
  FileText,
  Globe,
  Hash,
  Layers,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  ScrollText,
  User as UserIcon,
} from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { getAssignableLeadOwnerOptions, type LeadOwnerMembership } from '@/lib/lead-owner';
import {
  canAssignLeads,
  canCreateInteraction,
  canEditLead,
  canResolveReassignment,
} from '@/lib/lead-permissions';
import {
  getLeadStatusVariant,
  getReassignmentStatusVariant,
  LEAD_STATUS_LABEL,
  REASSIGNMENT_STATUS_LABEL,
} from '@/lib/lead-status';
import { listLeadDocumentsAction } from '@/lib/document-actions';
import { listLeadQuotesAction } from '@/lib/quote-actions';
import { listLeadTasksAction } from '@/lib/task-actions';
import { listLeadPortalTokensAction } from '@/lib/portal-actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InteractionTimeline } from '@/components/leads/interaction-timeline';
import { DocumentList } from '@/components/documents/document-list';
import { DocumentUploadZone } from '@/components/documents/document-upload-zone';
import { QuoteDialogTrigger } from '@/components/quotes/quote-dialog-trigger';
import { QuoteList } from '@/components/quotes/quote-list';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { TaskList } from '@/components/tasks/task-list';
import { LeadFormDialog } from '../components/lead-form-dialog';
import { ReassignRequestDialog } from '../components/reassign-request-dialog';
import { ResolveReassignmentDialog } from '../components/resolve-reassignment-dialog';
import { PortalTokensCard } from '@/components/leads/portal-tokens-card';

function formatDate(value: Date) {
  return value.toLocaleString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
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

  const [
    assignmentsEnabled,
    interactionsEnabled,
    documentsEnabled,
    quotingEnabled,
    tasksEnabled,
    portalEnabled,
  ] = await Promise.all([
    isTenantFeatureEnabled(tenant.id, 'ASSIGNMENTS'),
    isTenantFeatureEnabled(tenant.id, 'INTERACTIONS'),
    isTenantFeatureEnabled(tenant.id, 'DOCUMENTS'),
    isTenantFeatureEnabled(tenant.id, 'QUOTING_BASIC'),
    isTenantFeatureEnabled(tenant.id, 'TASKS'),
    isTenantFeatureEnabled(tenant.id, 'CLIENT_PORTAL'),
  ]);

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

  const interactionsPromise = interactionsEnabled
    ? db.interaction.findMany({
        where: { leadId: id, tenantId: tenant.id },
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          leadId: true,
          type: true,
          subject: true,
          notes: true,
          occurredAt: true,
          createdAt: true,
          authorId: true,
          author: { select: { name: true, email: true } },
        },
      })
    : Promise.resolve([]);

  const documentsPromise = documentsEnabled
    ? listLeadDocumentsAction(id, tenantSlug).catch(() => [])
    : Promise.resolve([]);

  const quotesPromise = quotingEnabled
    ? listLeadQuotesAction(id, tenantSlug).catch(() => [])
    : Promise.resolve([]);

  const tasksPromise = tasksEnabled
    ? listLeadTasksAction(id, tenantSlug).catch(() => [])
    : Promise.resolve([]);

  const portalTokensPromise = portalEnabled
    ? listLeadPortalTokensAction({ tenantSlug, leadId: id }).catch(() => [])
    : Promise.resolve([]);

  const [lead, activeOwners, interactions, documents, quotes, tasks, portalTokens] =
    await Promise.all([
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
      interactionsPromise,
      documentsPromise,
      quotesPromise,
      tasksPromise,
      portalTokensPromise,
    ]);

  if (!lead) {
    notFound();
  }

  const assignableOwners = getAssignableLeadOwnerOptions(activeOwners);
  const canAssign = assignmentsEnabled && canAssignLeads(actor);
  const canResolve = assignmentsEnabled && canResolveReassignment(actor);
  const canEdit = canEditLead(actor, { ownerId: lead.ownerId });
  const canCreateInteractionForLead = interactionsEnabled && canCreateInteraction(actor);

  const taskMembers = activeOwners.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  const ownerLabel = lead.owner?.name || lead.owner?.email;
  const locationParts = [lead.city, lead.country].filter(Boolean);

  return (
    <div className="min-w-0 space-y-6">
      {/* ── Hero ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <Avatar className="h-14 w-14 shrink-0 text-lg">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {getInitials(lead.businessName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1.5">
            <Badge variant={getLeadStatusVariant(lead.status)}>
              {LEAD_STATUS_LABEL[lead.status]}
            </Badge>
            <h1 className="truncate text-2xl font-bold leading-tight">{lead.businessName}</h1>

            {/* Owner */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {ownerLabel ? (
                <>
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(ownerLabel)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{ownerLabel}</span>
                </>
              ) : (
                <>
                  <UserIcon className="size-3.5" />
                  <span className="italic">Sin owner asignado</span>
                </>
              )}
            </div>

            {/* Meta */}
            {(lead.source || locationParts.length > 0 || lead.ruc) && (
              <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                {lead.source && <span>{lead.source}</span>}
                {lead.source && locationParts.length > 0 && <span aria-hidden>·</span>}
                {locationParts.length > 0 && <span>{locationParts.join(', ')}</span>}
                {(lead.source || locationParts.length > 0) && lead.ruc && (
                  <span aria-hidden>·</span>
                )}
                {lead.ruc && <span>RUC {lead.ruc}</span>}
              </div>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                Actualizado {formatDate(lead.updatedAt)}
              </span>
              <span>Creado {formatDate(lead.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${tenantSlug}/leads`}>
              <ArrowLeft className="size-3.5" />
              Leads
            </Link>
          </Button>

          {canEdit && (
            <LeadFormDialog
              tenantSlug={tenantSlug}
              owners={assignableOwners}
              canAssign={canAssign}
              lead={lead}
              trigger={
                <Button type="button" size="sm">
                  Editar lead
                </Button>
              }
            />
          )}

          {!canEdit && assignmentsEnabled && lead.ownerId && assignableOwners.length > 0 && (
            <ReassignRequestDialog
              tenantSlug={tenantSlug}
              leadId={lead.id}
              owners={assignableOwners}
              trigger={
                <Button type="button" size="sm">
                  Solicitar reasignación
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="datos">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="datos" className="gap-1.5">
            <Building2 className="size-3.5" />
            Datos
          </TabsTrigger>
          <TabsTrigger value="interacciones" disabled={!interactionsEnabled} className="gap-1.5">
            <MessageSquare className="size-3.5" />
            Interacciones
            {interactions.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none"
              >
                {interactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reasignaciones" className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Reasignaciones
            {lead.reassignmentRequests.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none"
              >
                {lead.reassignmentRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="documentos" disabled={!documentsEnabled} className="gap-1.5">
            <FileText className="size-3.5" />
            Documentos
            {documents.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none"
              >
                {documents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cotizaciones" disabled={!quotingEnabled} className="gap-1.5">
            <ScrollText className="size-3.5" />
            Cotizaciones
            {quotes.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none"
              >
                {quotes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tareas" disabled={!tasksEnabled} className="gap-1.5">
            <ClipboardList className="size-3.5" />
            Tareas
            {tasks.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none"
              >
                {tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED').length ||
                  tasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="portal" disabled={!portalEnabled} className="gap-1.5">
            <Globe className="size-3.5" />
            Portal
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Datos ── */}
        <TabsContent value="datos" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos comerciales</CardTitle>
              <CardDescription>
                Información principal del prospecto y su contexto de negocio.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                <div className="flex items-start gap-3 px-6 py-3.5">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Razón social</p>
                    <p className="font-medium">{lead.businessName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-6 py-3.5">
                  <Hash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">RUC</p>
                    <p className="font-medium">{lead.ruc || 'No registrado'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-6 py-3.5">
                  <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Rubro</p>
                    <p className="font-medium">{lead.industry || 'No registrado'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-6 py-3.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ubicación</p>
                    <p className="font-medium">
                      {[lead.city, lead.country].filter(Boolean).join(', ') || 'No registrada'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contacto</CardTitle>
              <CardDescription>Canales disponibles para contactar al prospecto.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Phone className="size-3.5" />
                  Teléfonos
                </p>
                {lead.phones.length > 0 ? (
                  <ul className="space-y-1.5">
                    {lead.phones.map((phone) => (
                      <li key={phone}>
                        <a
                          href={`tel:${phone}`}
                          className="flex items-center gap-1.5 text-sm hover:underline"
                        >
                          <Phone className="size-3 text-muted-foreground" />
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin teléfonos registrados.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Mail className="size-3.5" />
                  Emails
                </p>
                {lead.emails.length > 0 ? (
                  <ul className="space-y-1.5">
                    {lead.emails.map((email) => (
                      <li key={email}>
                        <a
                          href={`mailto:${email}`}
                          className="flex items-center gap-1.5 text-sm hover:underline"
                        >
                          <Mail className="size-3 text-muted-foreground" />
                          {email}
                        </a>
                      </li>
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
        </TabsContent>

        {/* ── Tab: Interacciones ── */}
        <TabsContent value="interacciones" className="mt-6">
          {interactionsEnabled ? (
            <Card>
              <CardContent className="pt-6">
                <InteractionTimeline
                  interactions={interactions}
                  tenantSlug={tenantSlug}
                  leadId={lead.id}
                  currentUserId={actor.userId}
                  currentRole={actor.role}
                  isSuperAdmin={actor.isSuperAdmin}
                  canCreate={canCreateInteractionForLead}
                  currentStatus={lead.status}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <MessageSquare className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                El módulo de interacciones no está activo para este tenant.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Reasignaciones ── */}
        <TabsContent value="reasignaciones" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Historial de reasignaciones</CardTitle>
              <CardDescription>
                Seguimiento de solicitudes, aprobaciones y rechazos alrededor del ownership.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lead.reassignmentRequests.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
                  <RefreshCw className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Este lead no tiene solicitudes de reasignación todavía.
                  </p>
                </div>
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
                        <p className="whitespace-pre-wrap">{request.reason}</p>
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
        </TabsContent>

        {/* ── Tab: Documentos ── */}
        <TabsContent value="documentos" className="mt-6 space-y-4">
          {documentsEnabled ? (
            <>
              <DocumentUploadZone tenantSlug={tenantSlug} leadId={lead.id} />
              <DocumentList
                docs={documents}
                tenantSlug={tenantSlug}
                currentUserId={actor.userId}
                currentRole={actor.role}
                isSuperAdmin={actor.isSuperAdmin}
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <FileText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                El módulo de documentos no está activo para este tenant.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cotizaciones" className="mt-6">
          {quotingEnabled ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                <div>
                  <CardTitle>Cotizaciones</CardTitle>
                  <CardDescription>Propuestas comerciales asociadas a este lead.</CardDescription>
                </div>
                <QuoteDialogTrigger
                  tenantSlug={tenantSlug}
                  leads={[{ id: lead.id, businessName: lead.businessName, ruc: lead.ruc }]}
                  defaultLeadId={lead.id}
                />
              </CardHeader>
              <CardContent className="p-0 pb-1">
                <QuoteList
                  quotes={quotes}
                  tenantSlug={tenantSlug}
                  currentUserId={actor.userId}
                  currentRole={actor.role}
                  isSuperAdmin={actor.isSuperAdmin}
                  showLeadColumn={false}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <ScrollText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                El módulo de cotizaciones no está activo para este tenant.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Tareas ── */}
        <TabsContent value="tareas" className="mt-6">
          {tasksEnabled ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                <div>
                  <CardTitle>Tareas</CardTitle>
                  <CardDescription>Acciones pendientes y seguimiento de este lead.</CardDescription>
                </div>
                <TaskFormDialog tenantSlug={tenantSlug} leadId={lead.id} members={taskMembers} />
              </CardHeader>
              <CardContent className="px-0 pb-2">
                <TaskList
                  tasks={tasks}
                  tenantSlug={tenantSlug}
                  currentUserId={actor.userId}
                  currentRole={actor.role}
                  isSuperAdmin={actor.isSuperAdmin}
                  members={taskMembers}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <ClipboardList className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                El módulo de tareas no está activo para este tenant.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Portal ── */}
        <TabsContent value="portal" className="mt-6">
          {portalEnabled ? (
            <PortalTokensCard tenantSlug={tenantSlug} leadId={lead.id} tokens={portalTokens} />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <Globe className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                El portal de cliente no está activo para este tenant.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
