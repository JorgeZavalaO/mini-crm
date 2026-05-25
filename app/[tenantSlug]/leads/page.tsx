import Link from 'next/link';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { getAssignableLeadOwnerOptions, toLeadOwnerOption } from '@/lib/lead-owner';
import { buildLeadWhereClause } from '@/lib/lead-query';
import {
  canAssignLeads,
  canEditLead,
  canImportLeads,
  canManageDuplicateLeads,
  canResolveReassignment,
} from '@/lib/lead-permissions';
import { leadFiltersSchema } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { LeadFilters } from './components/lead-filters';
import { LeadTable } from './components/lead-table';
import { LeadExportButton } from './components/lead-export-button';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toFilterHref(filters: {
  q?: string;
  status?: string;
  ownerId?: string;
  country?: string;
  province?: string;
  source?: string;
  city?: string;
  district?: string;
  constitutionYearMin?: number;
  constitutionYearMax?: number;
  employeeCountMin?: number;
  employeeCountMax?: number;
  importOperationCountMin?: number;
  importOperationCountMax?: number;
  exportOperationCountMin?: number;
  exportOperationCountMax?: number;
  page: number;
}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.ownerId) params.set('ownerId', filters.ownerId);
  if (filters.country) params.set('country', filters.country);
  if (filters.province) params.set('province', filters.province);
  if (filters.source) params.set('source', filters.source);
  if (filters.city) params.set('city', filters.city);
  if (filters.district) params.set('district', filters.district);
  if (filters.constitutionYearMin !== undefined) {
    params.set('constitutionYearMin', String(filters.constitutionYearMin));
  }
  if (filters.constitutionYearMax !== undefined) {
    params.set('constitutionYearMax', String(filters.constitutionYearMax));
  }
  if (filters.employeeCountMin !== undefined) {
    params.set('employeeCountMin', String(filters.employeeCountMin));
  }
  if (filters.employeeCountMax !== undefined) {
    params.set('employeeCountMax', String(filters.employeeCountMax));
  }
  if (filters.importOperationCountMin !== undefined) {
    params.set('importOperationCountMin', String(filters.importOperationCountMin));
  }
  if (filters.importOperationCountMax !== undefined) {
    params.set('importOperationCountMax', String(filters.importOperationCountMax));
  }
  if (filters.exportOperationCountMin !== undefined) {
    params.set('exportOperationCountMin', String(filters.exportOperationCountMin));
  }
  if (filters.exportOperationCountMax !== undefined) {
    params.set('exportOperationCountMax', String(filters.exportOperationCountMax));
  }
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
    country: firstParam(rawSearchParams.country),
    province: firstParam(rawSearchParams.province),
    source: firstParam(rawSearchParams.source),
    city: firstParam(rawSearchParams.city),
    district: firstParam(rawSearchParams.district),
    constitutionYearMin: firstParam(rawSearchParams.constitutionYearMin),
    constitutionYearMax: firstParam(rawSearchParams.constitutionYearMax),
    employeeCountMin: firstParam(rawSearchParams.employeeCountMin),
    employeeCountMax: firstParam(rawSearchParams.employeeCountMax),
    importOperationCountMin: firstParam(rawSearchParams.importOperationCountMin),
    importOperationCountMax: firstParam(rawSearchParams.importOperationCountMax),
    exportOperationCountMin: firstParam(rawSearchParams.exportOperationCountMin),
    exportOperationCountMax: firstParam(rawSearchParams.exportOperationCountMax),
    page: firstParam(rawSearchParams.page) ?? '1',
  });

  const filters = parsedFilters.success ? parsedFilters.data : leadFiltersSchema.parse({ page: 1 });

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
    isActiveMember: session.user.isSuperAdmin || Boolean(membership?.isActive),
    restrictLeadEditingToOwner: tenant.restrictLeadEditingToOwner,
  };

  const [assignmentsEnabled, importEnabled, interactionsEnabled, dedupeEnabled] = await Promise.all(
    [
      isTenantFeatureEnabled(tenant.id, 'ASSIGNMENTS'),
      isTenantFeatureEnabled(tenant.id, 'IMPORT'),
      isTenantFeatureEnabled(tenant.id, 'INTERACTIONS'),
      isTenantFeatureEnabled(tenant.id, 'DEDUPE'),
    ],
  );
  const canAssign = assignmentsEnabled && canAssignLeads(actor);
  const canResolve = assignmentsEnabled && canResolveReassignment(actor);
  const canImport = importEnabled && canImportLeads(actor);
  const canImportInteractions = canImport && interactionsEnabled;
  const canManageDuplicates = dedupeEnabled && canManageDuplicateLeads(actor);

  const where = buildLeadWhereClause(tenant.id, filters);

  const totalCount = await db.lead.count({ where });
  const pageSize = filters.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const skip = (currentPage - 1) * pageSize;

  const [
    rawLeads,
    activeOwners,
    countryRows,
    provinceRows,
    sourceRows,
    cityRows,
    districtRows,
    rawPendingReassignments,
  ] = await Promise.all([
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
        country: true,
        province: true,
        city: true,
        district: true,
        address: true,
        constitutionYear: true,
        employeeCount: true,
        importOperationCount: true,
        exportOperationCount: true,
        source: true,
        industry: true,
        notes: true,
        phones: true,
        emails: true,
        gerente: true,
        contactName: true,
        contactPhone: true,
        contacts: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            phones: true,
            emails: true,
            role: true,
            notes: true,
            isPrimary: true,
            sortOrder: true,
          },
        },
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
        isActive: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null, country: { not: null } },
      select: { country: true },
      distinct: ['country'],
      orderBy: { country: 'asc' },
    }),
    db.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null, province: { not: null } },
      select: { province: true },
      distinct: ['province'],
      orderBy: { province: 'asc' },
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
    db.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null, district: { not: null } },
      select: { district: true },
      distinct: ['district'],
      orderBy: { district: 'asc' },
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
            requestedOwnerId: true,
            lead: { select: { businessName: true } },
            requestedBy: { select: { name: true, email: true } },
            requestedOwner: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const owners = activeOwners.map(toLeadOwnerOption);
  const assignableOwners = getAssignableLeadOwnerOptions(activeOwners);

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
    requestedOwnerId: request.requestedOwnerId,
    requestedBy: request.requestedBy,
    requestedOwner: request.requestedOwner,
  }));

  const sources = sourceRows
    .map((row) => row.source)
    .filter((value): value is string => Boolean(value));
  const countries = countryRows
    .map((row) => row.country)
    .filter((value): value is string => Boolean(value));
  const provinces = provinceRows
    .map((row) => row.province)
    .filter((value): value is string => Boolean(value));
  const cities = cityRows.map((row) => row.city).filter((value): value is string => Boolean(value));
  const districts = districtRows
    .map((row) => row.district)
    .filter((value): value is string => Boolean(value));
  const filterState = {
    q: filters.q,
    status: filters.status,
    ownerId: filters.ownerId,
    country: filters.country,
    province: filters.province,
    source: filters.source,
    city: filters.city,
    district: filters.district,
    constitutionYearMin: filters.constitutionYearMin,
    constitutionYearMax: filters.constitutionYearMax,
    employeeCountMin: filters.employeeCountMin,
    employeeCountMax: filters.employeeCountMax,
    importOperationCountMin: filters.importOperationCountMin,
    importOperationCountMax: filters.importOperationCountMax,
    exportOperationCountMin: filters.exportOperationCountMin,
    exportOperationCountMax: filters.exportOperationCountMax,
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Gestiona prospectos, ownership, importaciones y solicitudes de reasignacion.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <LeadExportButton tenantSlug={tenantSlug} />
          {canImport && (
            <Button variant="outline" asChild>
              <Link href={`/${tenantSlug}/leads/import`}>Importar leads</Link>
            </Button>
          )}
          {canImportInteractions && (
            <Button variant="outline" asChild>
              <Link href={`/${tenantSlug}/leads/interactions/import`}>Importar interacciones</Link>
            </Button>
          )}
          {canManageDuplicates && (
            <Button variant="outline" asChild>
              <Link href={`/${tenantSlug}/leads/dedupe`}>Revisar duplicados</Link>
            </Button>
          )}
        </div>
      </div>

      <LeadFilters
        initial={{
          q: filters.q,
          status: filters.status,
          ownerId: filters.ownerId,
          country: filters.country,
          province: filters.province,
          source: filters.source,
          city: filters.city,
          district: filters.district,
          constitutionYearMin: filters.constitutionYearMin,
          constitutionYearMax: filters.constitutionYearMax,
          employeeCountMin: filters.employeeCountMin,
          employeeCountMax: filters.employeeCountMax,
          importOperationCountMin: filters.importOperationCountMin,
          importOperationCountMax: filters.importOperationCountMax,
          exportOperationCountMin: filters.exportOperationCountMin,
          exportOperationCountMax: filters.exportOperationCountMax,
        }}
        owners={owners}
        countries={countries}
        provinces={provinces}
        sources={sources}
        cities={cities}
        districts={districts}
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
        assignableOwners={assignableOwners}
        totalCount={totalCount}
        assignmentsEnabled={assignmentsEnabled}
        canAssign={canAssign && assignableOwners.length > 0}
        canResolveReassignments={canResolve}
        pendingReassignments={pendingReassignments}
      />

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {currentPage > 1 ? (
                <PaginationPrevious
                  href={toFilterHref({ ...filterState, page: currentPage - 1 })}
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
                <PaginationNext href={toFilterHref({ ...filterState, page: currentPage + 1 })} />
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
