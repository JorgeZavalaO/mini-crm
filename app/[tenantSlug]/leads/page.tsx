import type { Prisma } from '@prisma/client';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { normalizeLeadName, normalizeRuc } from '@/lib/lead-normalization';
import { canAssignLeads, canEditLead, canResolveReassignment } from '@/lib/lead-permissions';
import { leadFiltersSchema } from '@/lib/validators';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { LeadFilters } from './components/lead-filters';
import { LeadTable } from './components/lead-table';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toFilterHref(filters: {
  q?: string;
  status?: string;
  ownerId?: string;
  source?: string;
  city?: string;
  page: number;
}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.ownerId) params.set('ownerId', filters.ownerId);
  if (filters.source) params.set('source', filters.source);
  if (filters.city) params.set('city', filters.city);
  params.set('page', String(filters.page));
  return `?${params.toString()}`;
}

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const [{ tenant, membership, session }, rawSearchParams] = await Promise.all([
    requireTenantFeature(tenantSlug, 'CRM_LEADS'),
    searchParams,
  ]);

  const parsedFilters = leadFiltersSchema.safeParse({
    q: firstParam(rawSearchParams.q),
    status: firstParam(rawSearchParams.status),
    ownerId: firstParam(rawSearchParams.ownerId),
    source: firstParam(rawSearchParams.source),
    city: firstParam(rawSearchParams.city),
    page: firstParam(rawSearchParams.page) ?? '1',
  });

  const filters = parsedFilters.success ? parsedFilters.data : leadFiltersSchema.parse({ page: 1 });

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
    isActiveMember: session.user.isSuperAdmin || Boolean(membership?.isActive),
  };

  const assignmentsEnabled = await isTenantFeatureEnabled(tenant.id, 'ASSIGNMENTS');
  const canAssign = assignmentsEnabled && canAssignLeads(actor);
  const canResolve = assignmentsEnabled && canResolveReassignment(actor);

  const where: Prisma.LeadWhereInput = {
    tenantId: tenant.id,
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.city ? { city: filters.city } : {}),
  };

  const q = filters.q?.trim();
  if (q) {
    const normalizedName = normalizeLeadName(q);
    const normalizedRuc = normalizeRuc(q);
    where.OR = [
      { businessName: { contains: q, mode: 'insensitive' } },
      { nameNormalized: { contains: normalizedName } },
      ...(normalizedRuc ? [{ rucNormalized: { contains: normalizedRuc } }] : []),
      { emails: { has: q.toLowerCase() } },
      { phones: { has: q } },
    ];
  }

  const totalCount = await db.lead.count({ where });
  const pageSize = filters.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const skip = (currentPage - 1) * pageSize;

  const [rawLeads, activeOwners, sourceRows, cityRows, rawPendingReassignments] = await Promise.all(
    [
      db.lead.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          businessName: true,
          ruc: true,
          status: true,
          city: true,
          source: true,
          country: true,
          industry: true,
          notes: true,
          phones: true,
          emails: true,
          ownerId: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, email: true } },
          reassignmentRequests: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              status: true,
              reason: true,
              createdAt: true,
              requestedBy: { select: { name: true, email: true } },
              requestedOwner: { select: { name: true, email: true } },
            },
          },
        },
      }),
      db.membership.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.lead.findMany({
        where: { tenantId: tenant.id, deletedAt: null, source: { not: null } },
        select: { source: true },
        distinct: ['source'],
        orderBy: { source: 'asc' },
      }),
      db.lead.findMany({
        where: { tenantId: tenant.id, deletedAt: null, city: { not: null } },
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' },
      }),
      canResolve
        ? db.leadReassignmentRequest.findMany({
            where: { tenantId: tenant.id, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              leadId: true,
              reason: true,
              createdAt: true,
              lead: { select: { businessName: true } },
              requestedBy: { select: { name: true, email: true } },
              requestedOwner: { select: { name: true, email: true } },
            },
          })
        : Promise.resolve([]),
    ],
  );

  const owners = activeOwners.map((membershipRow) => ({
    id: membershipRow.user.id,
    name: membershipRow.user.name ?? '',
    email: membershipRow.user.email,
    role: membershipRow.role,
  }));

  const leads = rawLeads.map((lead) => ({
    ...lead,
    updatedAt: lead.updatedAt.toISOString(),
    permissions: {
      canEdit: canEditLead(actor, { ownerId: lead.ownerId }),
    },
    reassignmentRequests: lead.reassignmentRequests.map((request) => ({
      ...request,
      createdAt: request.createdAt.toISOString(),
    })),
  }));

  const pendingReassignments = rawPendingReassignments.map((request) => ({
    id: request.id,
    leadId: request.leadId,
    leadBusinessName: request.lead.businessName,
    reason: request.reason,
    createdAt: request.createdAt.toISOString(),
    requestedBy: request.requestedBy,
    requestedOwner: request.requestedOwner,
  }));

  const sources = sourceRows
    .map((row) => row.source)
    .filter((value): value is string => Boolean(value));
  const cities = cityRows.map((row) => row.city).filter((value): value is string => Boolean(value));

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leads</h1>
        <p className="text-muted-foreground">
          Gestiona prospectos, ownership y solicitudes de reasignacion.
        </p>
      </div>

      <LeadFilters
        initial={{
          q: filters.q,
          status: filters.status,
          ownerId: filters.ownerId,
          source: filters.source,
          city: filters.city,
        }}
        owners={owners}
        sources={sources}
        cities={cities}
      />

      {!assignmentsEnabled && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          El modulo de asignaciones esta deshabilitado para este tenant. El CRUD de leads sigue
          disponible en modo sin ownership avanzado.
        </p>
      )}

      <LeadTable
        tenantSlug={tenantSlug}
        leads={leads}
        owners={owners}
        totalCount={totalCount}
        assignmentsEnabled={assignmentsEnabled}
        canAssign={canAssign}
        canResolveReassignments={canResolve}
        pendingReassignments={pendingReassignments}
      />

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {currentPage > 1 ? (
                <PaginationPrevious
                  href={toFilterHref({
                    q: filters.q,
                    status: filters.status,
                    ownerId: filters.ownerId,
                    source: filters.source,
                    city: filters.city,
                    page: currentPage - 1,
                  })}
                />
              ) : (
                <PaginationPrevious href="#" className="pointer-events-none opacity-50" />
              )}
            </PaginationItem>
            <PaginationItem>
              <span className="px-3 text-sm text-muted-foreground">
                Pagina {currentPage} de {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              {currentPage < totalPages ? (
                <PaginationNext
                  href={toFilterHref({
                    q: filters.q,
                    status: filters.status,
                    ownerId: filters.ownerId,
                    source: filters.source,
                    city: filters.city,
                    page: currentPage + 1,
                  })}
                />
              ) : (
                <PaginationNext href="#" className="pointer-events-none opacity-50" />
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
