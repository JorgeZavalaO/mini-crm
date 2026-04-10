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
import { formatDateTime } from '@/lib/date-utils';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { getAssignableLeadOwnerOptions, type LeadOwnerMembership } from '@/lib/lead-owner';
import { listLeadInteractionsAction } from '@/lib/interaction-actions';
import {
  canAssignLeads,
  canCreateInteraction,
  canEditLead,
  canResolveReassignment,
  canViewPortalTokens,
} from '@/lib/lead-permissions';
import { buildSearchHref, firstSearchParam, getPaginationState } from '@/lib/pagination';
import {
  getLeadStatusVariant,
  getReassignmentStatusVariant,
  LEAD_STATUS_LABEL,
  REASSIGNMENT_STATUS_LABEL,
} from '@/lib/lead-status';
import { listLeadDocumentsPageAction } from '@/lib/document-actions';
import { listLeadQuotesPageAction } from '@/lib/quote-actions';
import { listLeadTasksPageAction } from '@/lib/task-actions';
import { listLeadPortalTokensPageAction } from '@/lib/portal-actions';
import { listLeadOwnerHistoryAction } from '@/lib/lead-actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListPagination } from '@/components/ui/list-pagination';
import { Separator } from '@/components/ui/separator';
import { InteractionTimeline } from '@/components/leads/interaction-timeline';
import { LeadDetailTabs } from '@/components/leads/lead-detail-tabs';
import { OwnerHistoryTimeline } from '@/components/leads/owner-history-timeline';
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function parsePage(value: string | string[] | undefined) {
  const raw = firstSearchParam(value);
  const numeric = Number(raw ?? '1');

  if (!Number.isFinite(numeric) || numeric < 1) {
    return 1;
  }

  return Math.floor(numeric);
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug, id } = await params;
  const [{ tenant, membership, session }, rawSearchParams] = await Promise.all([
    requireTenantFeature(tenantSlug, 'CRM_LEADS'),
    searchParams,
  ]);

  const requestedTab = firstSearchParam(rawSearchParams.tab);
  const interactionsPage = parsePage(rawSearchParams.interactionsPage);
  const reassignmentsPage = parsePage(rawSearchParams.reassignmentsPage);
  const ownerHistoryPage = parsePage(rawSearchParams.ownerHistoryPage);
  const documentsPage = parsePage(rawSearchParams.documentsPage);
  const quotesPage = parsePage(rawSearchParams.quotesPage);
  const tasksPage = parsePage(rawSearchParams.tasksPage);
  const portalPage = parsePage(rawSearchParams.portalPage);

  const interactionsPageSize = 10;
  const reassignmentsPageSize = 5;
  const ownerHistoryPageSize = 10;
  const documentsPageSize = 10;
  const quotesPageSize = 10;
  const tasksPageSize = 10;
  const portalPageSize = 10;

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

  const canViewLeadPortal = portalEnabled && canViewPortalTokens(actor);
  const canResolveEarly = assignmentsEnabled && canResolveReassignment(actor);

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
    ? listLeadInteractionsAction({
        tenantSlug,
        leadId: id,
        page: interactionsPage,
        pageSize: interactionsPageSize,
      }).catch(() => ({ interactions: [], total: 0 }))
    : Promise.resolve({ interactions: [], total: 0 });

  const documentsPromise = documentsEnabled
    ? listLeadDocumentsPageAction({
        tenantSlug,
        leadId: id,
        page: documentsPage,
        pageSize: documentsPageSize,
      }).catch(() => ({ docs: [], total: 0 }))
    : Promise.resolve({ docs: [], total: 0 });

  const quotesPromise = quotingEnabled
    ? listLeadQuotesPageAction({
        tenantSlug,
        leadId: id,
        page: quotesPage,
        pageSize: quotesPageSize,
      }).catch(() => ({ quotes: [], total: 0 }))
    : Promise.resolve({ quotes: [], total: 0 });

  const productsPromise = quotingEnabled
    ? db.product.findMany({
        where: { tenantId: tenant.id, deletedAt: null, isActive: true },
        orderBy: { name: 'asc' },
        take: 200,
        select: {
          id: true,
          name: true,
          description: true,
          unitPrice: true,
          currency: true,
          taxExempt: true,
        },
      })
    : Promise.resolve([]);

  const tasksPromise = tasksEnabled
    ? listLeadTasksPageAction({
        tenantSlug,
        leadId: id,
        page: tasksPage,
        pageSize: tasksPageSize,
      }).catch(() => ({ tasks: [], total: 0 }))
    : Promise.resolve({ tasks: [], total: 0 });

  const portalTokensPromise = canViewLeadPortal
    ? listLeadPortalTokensPageAction({
        tenantSlug,
        leadId: id,
        page: portalPage,
        pageSize: portalPageSize,
      }).catch(() => ({ tokens: [], total: 0 }))
    : Promise.resolve({ tokens: [], total: 0 });

  const ownerHistoryPromise = canResolveEarly
    ? listLeadOwnerHistoryAction({
        tenantSlug,
        leadId: id,
        page: ownerHistoryPage,
        pageSize: ownerHistoryPageSize,
      }).catch(() => ({ items: [], total: 0 }))
    : Promise.resolve({ items: [], total: 0 });

  const reassignmentWhere = {
    tenantId: tenant.id,
    leadId: id,
  };

  const [
    lead,
    activeOwners,
    interactionsResult,
    documentsResult,
    quotesResult,
    rawProducts,
    tasksResult,
    portalTokensResult,
    reassignmentTotal,
    reassignmentRequests,
    portalActiveCount,
    portalInactiveCount,
    ownerHistoryResult,
  ] = await Promise.all([
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
        gerente: true,
        contactName: true,
        contactPhone: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    }),
    activeOwnersPromise,
    interactionsPromise,
    documentsPromise,
    quotesPromise,
    productsPromise,
    tasksPromise,
    portalTokensPromise,
    db.leadReassignmentRequest.count({ where: reassignmentWhere }),
    db.leadReassignmentRequest.findMany({
      where: reassignmentWhere,
      orderBy: { createdAt: 'desc' },
      skip: (reassignmentsPage - 1) * reassignmentsPageSize,
      take: reassignmentsPageSize,
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
    }),
    canViewLeadPortal
      ? db.portalToken.count({ where: { tenantId: tenant.id, leadId: id, isActive: true } })
      : Promise.resolve(0),
    canViewLeadPortal
      ? db.portalToken.count({ where: { tenantId: tenant.id, leadId: id, isActive: false } })
      : Promise.resolve(0),
    ownerHistoryPromise,
  ]);

  if (!lead) {
    notFound();
  }

  const assignableOwners = getAssignableLeadOwnerOptions(activeOwners);
  const canAssign = assignmentsEnabled && canAssignLeads(actor);
  const canResolve = assignmentsEnabled && canResolveReassignment(actor);
  const canEdit = canEditLead(actor, { ownerId: lead.ownerId });
  const canCreateInteractionForLead =
    interactionsEnabled && canCreateInteraction(actor, { ownerId: lead.ownerId });

  const interactions = interactionsResult.interactions;
  const interactionsTotal = interactionsResult.total;
  const documents = documentsResult.docs;
  const documentsTotal = documentsResult.total;
  const quotes = quotesResult.quotes;
  const quotesTotal = quotesResult.total;
  const products = rawProducts.map((p) => ({
    ...p,
    unitPrice: Number(p.unitPrice),
    currency: p.currency as 'PEN' | 'USD',
    taxExempt: p.taxExempt,
  }));
  const tasks = tasksResult.tasks;
  const tasksTotal = tasksResult.total;
  const portalTokens = portalTokensResult.tokens;
  const portalTokensTotal = portalTokensResult.total;
  const ownerHistoryItems = ownerHistoryResult.items;
  const ownerHistoryTotal = ownerHistoryResult.total;

  const requestedTabIsEnabled =
    requestedTab === 'interacciones'
      ? interactionsEnabled
      : requestedTab === 'documentos'
        ? documentsEnabled
        : requestedTab === 'cotizaciones'
          ? quotingEnabled
          : requestedTab === 'tareas'
            ? tasksEnabled
            : requestedTab === 'portal'
              ? canViewLeadPortal
              : true;

  const activeTab = requestedTab && requestedTabIsEnabled ? requestedTab : 'datos';

  const interactionsPagination = getPaginationState({
    totalItems: interactionsTotal,
    page: interactionsPage,
    pageSize: interactionsPageSize,
  });
  const reassignmentsPagination = getPaginationState({
    totalItems: reassignmentTotal,
    page: reassignmentsPage,
    pageSize: reassignmentsPageSize,
  });
  const documentsPagination = getPaginationState({
    totalItems: documentsTotal,
    page: documentsPage,
    pageSize: documentsPageSize,
  });
  const quotesPagination = getPaginationState({
    totalItems: quotesTotal,
    page: quotesPage,
    pageSize: quotesPageSize,
  });
  const tasksPagination = getPaginationState({
    totalItems: tasksTotal,
    page: tasksPage,
    pageSize: tasksPageSize,
  });
  const portalPagination = getPaginationState({
    totalItems: portalTokensTotal,
    page: portalPage,
    pageSize: portalPageSize,
  });
  const ownerHistoryPagination = getPaginationState({
    totalItems: ownerHistoryTotal,
    page: ownerHistoryPage,
    pageSize: ownerHistoryPageSize,
  });

  const searchState = {
    interactionsPage: interactionsPagination.currentPage,
    reassignmentsPage: reassignmentsPagination.currentPage,
    ownerHistoryPage: ownerHistoryPagination.currentPage,
    documentsPage: documentsPagination.currentPage,
    quotesPage: quotesPagination.currentPage,
    tasksPage: tasksPagination.currentPage,
    portalPage: portalPagination.currentPage,
  };

  const tabHrefs = {
    datos: buildSearchHref({ ...searchState }, { tab: 'datos' }),
    interacciones: buildSearchHref({ ...searchState }, { tab: 'interacciones' }),
    reasignaciones: buildSearchHref({ ...searchState }, { tab: 'reasignaciones' }),
    documentos: buildSearchHref({ ...searchState }, { tab: 'documentos' }),
    cotizaciones: buildSearchHref({ ...searchState }, { tab: 'cotizaciones' }),
    tareas: buildSearchHref({ ...searchState }, { tab: 'tareas' }),
    portal: buildSearchHref({ ...searchState }, { tab: 'portal' }),
  };
  const interactionsPageHref = (page: number) =>
    buildSearchHref({ ...searchState, tab: 'interacciones' }, { interactionsPage: page });
  const reassignmentsPageHref = (page: number) =>
    buildSearchHref({ ...searchState, tab: 'reasignaciones' }, { reassignmentsPage: page });
  const ownerHistoryPageHref = (page: number) =>
    buildSearchHref({ ...searchState, tab: 'reasignaciones' }, { ownerHistoryPage: page });
  const documentsPageHref = (page: number) =>
    buildSearchHref({ ...searchState, tab: 'documentos' }, { documentsPage: page });
  const quotesPageHref = (page: number) =>
    buildSearchHref({ ...searchState, tab: 'cotizaciones' }, { quotesPage: page });
  const tasksPageHref = (page: number) =>
    buildSearchHref({ ...searchState, tab: 'tareas' }, { tasksPage: page });
  const portalPageHref = (page: number) =>
    buildSearchHref({ ...searchState, tab: 'portal' }, { portalPage: page });

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
                  <span className="italic">Sin responsable asignado</span>
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
                Actualizado {formatDateTime(lead.updatedAt, tenant.companyTimezone)}
              </span>
              <span>Creado {formatDateTime(lead.createdAt, tenant.companyTimezone)}</span>
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

      <LeadDetailTabs
        activeTab={activeTab}
        items={[
          {
            value: 'datos',
            label: 'Datos',
            href: tabHrefs.datos,
            icon: <Building2 className="size-3.5" />,
            content: (
              <div className="space-y-4">
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
                            {[lead.city, lead.country].filter(Boolean).join(', ') ||
                              'No registrada'}
                          </p>
                        </div>
                      </div>
                      {lead.gerente && (
                        <div className="flex items-start gap-3 px-6 py-3.5">
                          <UserIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Gerente / Responsable</p>
                            <p className="font-medium">{lead.gerente}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contacto</CardTitle>
                    <CardDescription>
                      Canales disponibles para contactar al prospecto.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6 sm:grid-cols-2">
                    {(lead.contactName || lead.contactPhone) && (
                      <div className="space-y-1 sm:col-span-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <UserIcon className="size-3.5" />
                          Persona de contacto
                        </p>
                        {lead.contactName && (
                          <p className="text-sm font-medium">{lead.contactName}</p>
                        )}
                        {lead.contactPhone && (
                          <a
                            href={`tel:${lead.contactPhone}`}
                            className="flex items-center gap-1.5 text-sm hover:underline"
                          >
                            <Phone className="size-3 text-muted-foreground" />
                            {lead.contactPhone}
                          </a>
                        )}
                      </div>
                    )}
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
              </div>
            ),
          },
          {
            value: 'interacciones',
            label: 'Interacciones',
            href: tabHrefs.interacciones,
            icon: <MessageSquare className="size-3.5" />,
            disabled: !interactionsEnabled,
            badge: interactionsTotal,
            content: interactionsEnabled ? (
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <InteractionTimeline
                    interactions={interactions}
                    tenantSlug={tenantSlug}
                    leadId={lead.id}
                    currentUserId={actor.userId}
                    currentRole={actor.role}
                    isSuperAdmin={actor.isSuperAdmin}
                    canCreate={canCreateInteractionForLead}
                    currentStatus={lead.status}
                    totalCount={interactionsTotal}
                  />
                  <ListPagination
                    currentPage={interactionsPagination.currentPage}
                    totalPages={interactionsPagination.totalPages}
                    totalItems={interactionsTotal}
                    startItem={interactionsPagination.startItem}
                    endItem={interactionsPagination.endItem}
                    hrefForPage={interactionsPageHref}
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
            ),
          },
          {
            value: 'reasignaciones',
            label: 'Reasignaciones',
            href: tabHrefs.reasignaciones,
            icon: <RefreshCw className="size-3.5" />,
            badge: reassignmentTotal,
            content: (
              <Card>
                {canResolve && (
                  <>
                    <CardHeader>
                      <CardTitle>Historial de responsables</CardTitle>
                      <CardDescription>
                        Registro de todos los cambios de responsable, incluyendo asignaciones
                        directas y solicitudes aprobadas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <OwnerHistoryTimeline items={ownerHistoryItems} />
                      <ListPagination
                        currentPage={ownerHistoryPagination.currentPage}
                        totalPages={ownerHistoryPagination.totalPages}
                        totalItems={ownerHistoryTotal}
                        startItem={ownerHistoryPagination.startItem}
                        endItem={ownerHistoryPagination.endItem}
                        hrefForPage={ownerHistoryPageHref}
                      />
                    </CardContent>
                    <Separator />
                  </>
                )}

                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Solicitudes de reasignación</CardTitle>
                    <CardDescription>
                      Seguimiento de solicitudes, aprobaciones y rechazos alrededor del ownership.
                    </CardDescription>
                  </div>
                  {!canEdit &&
                    assignmentsEnabled &&
                    lead.ownerId &&
                    assignableOwners.length > 0 && (
                      <ReassignRequestDialog
                        tenantSlug={tenantSlug}
                        leadId={lead.id}
                        owners={assignableOwners}
                        trigger={
                          <Button type="button" size="sm" variant="outline">
                            <RefreshCw className="size-3.5" />
                            Solicitar reasignación
                          </Button>
                        }
                      />
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {reassignmentRequests.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
                      <RefreshCw className="size-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Este lead no tiene solicitudes de reasignación todavía.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reassignmentRequests.map((request) => (
                        <div key={request.id} className="space-y-3 rounded-lg border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant={getReassignmentStatusVariant(request.status)}>
                              {REASSIGNMENT_STATUS_LABEL[request.status]}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(request.createdAt, tenant.companyTimezone)}
                            </p>
                          </div>

                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="font-medium">Solicitado por:</span>{' '}
                              {request.requestedBy.name || request.requestedBy.email}
                            </p>
                            <p>
                              <span className="font-medium">Responsable sugerido:</span>{' '}
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
                              {formatDateTime(request.resolvedAt, tenant.companyTimezone)}
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

                  <ListPagination
                    currentPage={reassignmentsPagination.currentPage}
                    totalPages={reassignmentsPagination.totalPages}
                    totalItems={reassignmentTotal}
                    startItem={reassignmentsPagination.startItem}
                    endItem={reassignmentsPagination.endItem}
                    hrefForPage={reassignmentsPageHref}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            value: 'documentos',
            label: 'Documentos',
            href: tabHrefs.documentos,
            icon: <FileText className="size-3.5" />,
            disabled: !documentsEnabled,
            badge: documentsTotal,
            content: documentsEnabled ? (
              <div className="space-y-4">
                <DocumentUploadZone tenantSlug={tenantSlug} leadId={lead.id} />
                <DocumentList
                  docs={documents}
                  tenantSlug={tenantSlug}
                  currentUserId={actor.userId}
                  currentRole={actor.role}
                  isSuperAdmin={actor.isSuperAdmin}
                />
                <ListPagination
                  currentPage={documentsPagination.currentPage}
                  totalPages={documentsPagination.totalPages}
                  totalItems={documentsTotal}
                  startItem={documentsPagination.startItem}
                  endItem={documentsPagination.endItem}
                  hrefForPage={documentsPageHref}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
                <FileText className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  El módulo de documentos no está activo para este tenant.
                </p>
              </div>
            ),
          },
          {
            value: 'cotizaciones',
            label: 'Cotizaciones',
            href: tabHrefs.cotizaciones,
            icon: <ScrollText className="size-3.5" />,
            disabled: !quotingEnabled,
            badge: quotesTotal,
            content: quotingEnabled ? (
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
                    products={products}
                  />
                </CardHeader>
                <CardContent className="space-y-4 p-0 pb-4">
                  <QuoteList
                    quotes={quotes}
                    tenantSlug={tenantSlug}
                    currentUserId={actor.userId}
                    currentRole={actor.role}
                    isSuperAdmin={actor.isSuperAdmin}
                    showLeadColumn={false}
                  />
                  <div className="px-6">
                    <ListPagination
                      currentPage={quotesPagination.currentPage}
                      totalPages={quotesPagination.totalPages}
                      totalItems={quotesTotal}
                      startItem={quotesPagination.startItem}
                      endItem={quotesPagination.endItem}
                      hrefForPage={quotesPageHref}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
                <ScrollText className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  El módulo de cotizaciones no está activo para este tenant.
                </p>
              </div>
            ),
          },
          {
            value: 'tareas',
            label: 'Tareas',
            href: tabHrefs.tareas,
            icon: <ClipboardList className="size-3.5" />,
            disabled: !tasksEnabled,
            badge: tasksTotal,
            content: tasksEnabled ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                  <div>
                    <CardTitle>Tareas</CardTitle>
                    <CardDescription>
                      Acciones pendientes y seguimiento de este lead.
                    </CardDescription>
                  </div>
                  <TaskFormDialog
                    tenantSlug={tenantSlug}
                    leadId={lead.id}
                    members={taskMembers}
                    currentUserId={actor.userId}
                    currentRole={actor.role}
                  />
                </CardHeader>
                <CardContent className="space-y-4 px-0 pb-4">
                  <TaskList
                    tasks={tasks}
                    tenantSlug={tenantSlug}
                    currentUserId={actor.userId}
                    currentRole={actor.role}
                    isSuperAdmin={actor.isSuperAdmin}
                    members={taskMembers}
                  />
                  <div className="px-6">
                    <ListPagination
                      currentPage={tasksPagination.currentPage}
                      totalPages={tasksPagination.totalPages}
                      totalItems={tasksTotal}
                      startItem={tasksPagination.startItem}
                      endItem={tasksPagination.endItem}
                      hrefForPage={tasksPageHref}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
                <ClipboardList className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  El módulo de tareas no está activo para este tenant.
                </p>
              </div>
            ),
          },
          {
            value: 'portal',
            label: 'Portal',
            href: tabHrefs.portal,
            icon: <Globe className="size-3.5" />,
            disabled: !canViewLeadPortal,
            badge: portalTokensTotal,
            content: canViewLeadPortal ? (
              <div className="space-y-4">
                <PortalTokensCard
                  tenantSlug={tenantSlug}
                  leadId={lead.id}
                  tokens={portalTokens}
                  counts={{ active: portalActiveCount, inactive: portalInactiveCount }}
                />
                <ListPagination
                  currentPage={portalPagination.currentPage}
                  totalPages={portalPagination.totalPages}
                  totalItems={portalTokensTotal}
                  startItem={portalPagination.startItem}
                  endItem={portalPagination.endItem}
                  hrefForPage={portalPageHref}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
                <Globe className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  El portal de cliente no está activo para este tenant.
                </p>
              </div>
            ),
          },
        ].filter((item) => item.value !== 'portal' || canViewLeadPortal)}
      />
    </div>
  );
}
