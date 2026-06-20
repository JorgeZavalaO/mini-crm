import type { InteractionType, Prisma } from '@prisma/client';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { hasRole } from '@/lib/rbac';
import { getPaginationState } from '@/lib/pagination';
import { resolveReportRange, type ResolvedReportRange } from '@/lib/reporting/shared';
import type { InteractionReportFilters } from '@/lib/validators';
import {
  INTERACTION_LABEL,
  INTERACTION_TYPE_ORDER,
  type CompanyContactRow,
} from '@/lib/reporting/company-interactions-types';

export { INTERACTION_LABEL, INTERACTION_TYPE_ORDER };
export type { CompanyContactRow };

export type CompanyInteractionsReportData = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  actor: {
    canViewAll: boolean;
    appliedScope: 'mine' | 'all';
  };
  filters: InteractionReportFilters;
  range: ResolvedReportRange;
  summary: {
    companiesContacted: number;
    totalInteractions: number;
    companiesUncontacted: number;
    firstContactAt: Date | null;
    lastContactAt: Date | null;
  };
  interactionByType: Array<{ type: InteractionType; label: string; value: number }>;
  topAuthors: Array<{ id: string; name: string; value: number }>;
  rows: CompanyContactRow[];
  totalRows: number;
  pagination: ReturnType<typeof getPaginationState>;
  filterOptions: {
    authors: Array<{ id: string; name: string; email: string }>;
    cities: string[];
    countries: string[];
    industries: string[];
  };
};

function buildLeadWhere(
  tenantId: string,
  filters: InteractionReportFilters,
  scopeOwnerId: string | null,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    tenantId,
    deletedAt: null,
  };
  if (filters.leadStatus) where.status = filters.leadStatus;
  if (filters.leadOwnerId) where.ownerId = filters.leadOwnerId;
  if (filters.city) where.city = filters.city;
  if (filters.country) where.country = filters.country;
  if (filters.industry) where.industry = filters.industry;
  const q = filters.q?.trim();
  if (q) {
    where.OR = [{ businessName: { contains: q, mode: 'insensitive' } }, { ruc: { contains: q } }];
  }
  if (scopeOwnerId) {
    where.OR = [...(where.OR ?? []), { ownerId: scopeOwnerId }];
  }
  return where;
}

export async function getCompanyInteractionsReport(
  filters: InteractionReportFilters,
): Promise<CompanyInteractionsReportData> {
  const { tenant, membership, session } = await requireTenantFeature(
    filters.tenantSlug,
    'INTERACTIONS',
  );
  const canViewAll = session.user.isSuperAdmin || hasRole(membership?.role, 'SUPERVISOR');
  const appliedScope: 'mine' | 'all' = canViewAll ? filters.scope : 'mine';
  const scopeOwnerId = appliedScope === 'mine' ? session.user.id : null;

  const range = resolveReportRange({
    preset: filters.preset,
    from: filters.from,
    to: filters.to,
  });

  const leadWhere = buildLeadWhere(tenant.id, filters, scopeOwnerId);
  const interactionWhere: Prisma.InteractionWhereInput = {
    tenantId: tenant.id,
    occurredAt: { gte: range.from, lt: range.toExclusive },
    lead: leadWhere,
  };
  if (filters.type) interactionWhere.type = filters.type;
  if (filters.authorId) interactionWhere.authorId = filters.authorId;

  const [interactionsInRange, memberships, cityRows, countryRows, industryRows, leadsSegment] =
    await Promise.all([
      db.interaction.findMany({
        where: interactionWhere,
        orderBy: { occurredAt: 'asc' },
        select: {
          id: true,
          type: true,
          leadId: true,
          occurredAt: true,
          authorId: true,
          author: { select: { id: true, name: true, email: true } },
        },
      }),
      db.membership.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.lead.findMany({
        where: { tenantId: tenant.id, deletedAt: null, city: { not: null } },
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' },
      }),
      db.lead.findMany({
        where: { tenantId: tenant.id, deletedAt: null, country: { not: null } },
        select: { country: true },
        distinct: ['country'],
        orderBy: { country: 'asc' },
      }),
      db.lead.findMany({
        where: { tenantId: tenant.id, deletedAt: null, industry: { not: null } },
        select: { industry: true },
        distinct: ['industry'],
        orderBy: { industry: 'asc' },
      }),
      db.lead.findMany({
        where: leadWhere,
        select: { id: true },
      }),
    ]);

  const byLead = new Map<
    string,
    {
      firstAt: Date;
      lastAt: Date;
      types: Set<InteractionType>;
      authors: Map<string, string>;
      count: number;
    }
  >();

  const authorName = new Map<string, string>();
  const typeCounter = new Map<InteractionType, number>();
  const authorCounter = new Map<string, number>();
  let firstContactAt: Date | null = null;
  let lastContactAt: Date | null = null;

  for (const interaction of interactionsInRange) {
    const bucket = byLead.get(interaction.leadId) ?? {
      firstAt: interaction.occurredAt,
      lastAt: interaction.occurredAt,
      types: new Set<InteractionType>(),
      authors: new Map<string, string>(),
      count: 0,
    };
    if (interaction.occurredAt < bucket.firstAt) bucket.firstAt = interaction.occurredAt;
    if (interaction.occurredAt > bucket.lastAt) bucket.lastAt = interaction.occurredAt;
    bucket.types.add(interaction.type);
    bucket.count += 1;
    const label = interaction.author.name?.trim() || interaction.author.email;
    bucket.authors.set(interaction.authorId, label);
    authorName.set(interaction.authorId, label);
    byLead.set(interaction.leadId, bucket);
    typeCounter.set(interaction.type, (typeCounter.get(interaction.type) ?? 0) + 1);
    authorCounter.set(interaction.authorId, (authorCounter.get(interaction.authorId) ?? 0) + 1);
    if (firstContactAt === null || interaction.occurredAt < firstContactAt) {
      firstContactAt = interaction.occurredAt;
    }
    if (lastContactAt === null || interaction.occurredAt > lastContactAt) {
      lastContactAt = interaction.occurredAt;
    }
  }

  const contactedLeadIds = Array.from(byLead.keys());
  const contactedSet = new Set(contactedLeadIds);
  const uncontactedLeadsCount = leadsSegment.length - contactedSet.size;

  const leadsMeta =
    contactedLeadIds.length === 0
      ? []
      : await db.lead.findMany({
          where: { id: { in: contactedLeadIds }, tenantId: tenant.id, deletedAt: null },
          select: {
            id: true,
            businessName: true,
            ruc: true,
            status: true,
            ownerId: true,
            owner: { select: { name: true, email: true } },
            city: true,
            industry: true,
          },
        });

  const allRows: CompanyContactRow[] = leadsMeta
    .map((lead) => {
      const bucket = byLead.get(lead.id);
      if (!bucket) return null;
      return {
        leadId: lead.id,
        businessName: lead.businessName,
        ruc: lead.ruc ?? null,
        leadStatus: lead.status,
        leadOwnerId: lead.ownerId,
        leadOwnerName: lead.owner?.name?.trim() || lead.owner?.email || null,
        city: lead.city,
        industry: lead.industry,
        firstContactAt: bucket.firstAt,
        lastContactAt: bucket.lastAt,
        totalInteractions: bucket.count,
        channels: INTERACTION_TYPE_ORDER.filter((t) => bucket.types.has(t)),
        authors: Array.from(bucket.authors.entries()).map(([id, name]) => ({ id, name })),
      };
    })
    .filter((row): row is CompanyContactRow => row !== null)
    .sort((a, b) => b.lastContactAt.getTime() - a.lastContactAt.getTime());

  const pagination = getPaginationState({
    totalItems: allRows.length,
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const rows = allRows.slice(pagination.skip, pagination.skip + filters.pageSize);

  const interactionByType = INTERACTION_TYPE_ORDER.map((type) => ({
    type,
    label: INTERACTION_LABEL[type],
    value: typeCounter.get(type) ?? 0,
  }));

  const topAuthors = Array.from(authorCounter.entries())
    .map(([id, value]) => ({ id, name: authorName.get(id) ?? id, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'))
    .slice(0, 6);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      timezone: tenant.companyTimezone,
    },
    actor: {
      canViewAll,
      appliedScope,
    },
    filters,
    range,
    summary: {
      companiesContacted: contactedSet.size,
      totalInteractions: interactionsInRange.length,
      companiesUncontacted: Math.max(0, uncontactedLeadsCount),
      firstContactAt,
      lastContactAt,
    },
    interactionByType,
    topAuthors,
    rows,
    totalRows: allRows.length,
    pagination,
    filterOptions: {
      authors: memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name?.trim() || m.user.email,
        email: m.user.email,
      })),
      cities: cityRows.map((r) => r.city).filter((v): v is string => Boolean(v)),
      countries: countryRows.map((r) => r.country).filter((v): v is string => Boolean(v)),
      industries: industryRows.map((r) => r.industry).filter((v): v is string => Boolean(v)),
    },
  };
}
