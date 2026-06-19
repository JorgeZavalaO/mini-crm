import type { InteractionType, LeadStatus, Prisma, QuoteStatus, TaskStatus } from '@prisma/client';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { buildLeadStatusBuckets } from '@/lib/lead-status';
import { hasRole } from '@/lib/rbac';
import type { TenantReportFilters } from '@/lib/validators';
import {
  buildTimeSeries,
  computeDelta,
  incrementCounter,
  percentage,
  resolveComparisonRange,
  resolveReportRange,
  toTopMetrics,
  type Delta,
  type MetricDatum,
  type ResolvedReportRange,
} from '@/lib/reporting/shared';

const INTERACTION_LABEL: Record<InteractionType, string> = {
  CALL: 'Llamadas',
  EMAIL: 'Emails',
  NOTE: 'Notas',
  VISIT: 'Visitas',
  WHATSAPP: 'WhatsApp',
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Pendientes',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completadas',
  CANCELLED: 'Canceladas',
};

const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
};

const QUOTE_STATUS_ORDER: QuoteStatus[] = ['BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA'];
const TASK_STATUS_ORDER: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

type TenantFilterOptions = {
  owners: Array<{ id: string; label: string }>;
  sources: string[];
  countries: string[];
  cities: string[];
};

type QuoteReportRow = {
  status: QuoteStatus;
  totalAmount: Prisma.Decimal;
  createdAt: Date;
};

type TaskReportRow = {
  status: TaskStatus;
  completedAt: Date | null;
  createdAt: Date;
};

type LeadReportRow = {
  id: string;
  createdAt: Date;
  city: string | null;
  source: string | null;
  industry: string | null;
  status: LeadStatus;
  ownerId: string | null;
  owner: { name: string | null; email: string } | null;
};

type InteractionReportRow = {
  type: InteractionType;
  occurredAt: Date;
};

export type TenantReportsData = {
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
  range: ResolvedReportRange;
  comparisonRange: ResolvedReportRange;
  filters: TenantReportFilters;
  filterOptions: TenantFilterOptions;
  summary: {
    totalLeads: number;
    newLeadsInRange: number;
    newLeadsInRangeDelta: Delta;
    interactionsInRange: number;
    interactionsInRangeDelta: Delta;
    openTasks: number;
    completedTasksInRange: number;
    completedTasksInRangeDelta: Delta;
    quotesInRange: number;
    quotesInRangeDelta: Delta;
    quotePipelineAmount: number;
    winRate: number;
  };
  statusBuckets: ReturnType<typeof buildLeadStatusBuckets>;
  leadTrend: MetricDatum[];
  interactionTypeRows: MetricDatum[];
  topCities: MetricDatum[];
  topSources: MetricDatum[];
  topIndustries: MetricDatum[];
  taskStatusRows: MetricDatum[];
  quoteStatusRows: Array<{ label: string; value: number; amount: number }>;
  ownerPerformance: Array<{ label: string; leads: number; won: number }>;
};

export async function getTenantReportsData(
  filters: TenantReportFilters,
): Promise<TenantReportsData> {
  const { tenant, membership, session } = await requireTenantFeature(filters.tenantSlug, 'REPORTS');
  const canViewAll = session.user.isSuperAdmin || hasRole(membership?.role, 'SUPERVISOR');
  const appliedScope: 'mine' | 'all' = canViewAll ? filters.scope : 'mine';
  const effectiveOwnerId = appliedScope === 'mine' ? session.user.id : filters.ownerId;
  const range = resolveReportRange(filters);
  const comparisonRange = resolveComparisonRange(range);

  const segmentWhere: Prisma.LeadWhereInput = {
    tenantId: tenant.id,
    deletedAt: null,
    ...(effectiveOwnerId ? { ownerId: effectiveOwnerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.city ? { city: filters.city } : {}),
  };

  const relatedLeadWhere: Prisma.LeadWhereInput = {
    deletedAt: null,
    ...(effectiveOwnerId ? { ownerId: effectiveOwnerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.city ? { city: filters.city } : {}),
  };

  const [
    leadsSegment,
    memberships,
    sourceRows,
    countryRows,
    cityRows,
    leadsInRange,
    leadsInPreviousRange,
    interactionsInRange,
    interactionsInPreviousRange,
    tasksInRange,
    tasksInPreviousRange,
    quotesInRange,
    quotesInPreviousRange,
  ] = await Promise.all([
    db.lead.findMany({
      where: segmentWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        city: true,
        source: true,
        industry: true,
        status: true,
        ownerId: true,
        owner: { select: { name: true, email: true } },
      },
    }),
    db.membership.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
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
      where: { tenantId: tenant.id, deletedAt: null, country: { not: null } },
      select: { country: true },
      distinct: ['country'],
      orderBy: { country: 'asc' },
    }),
    db.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null, city: { not: null } },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    }),
    db.lead.findMany({
      where: {
        ...segmentWhere,
        createdAt: { gte: range.from, lt: range.toExclusive },
      },
      select: { id: true, createdAt: true },
    }),
    db.lead.findMany({
      where: {
        ...segmentWhere,
        createdAt: { gte: comparisonRange.from, lt: comparisonRange.toExclusive },
      },
      select: { id: true },
    }),
    db.interaction.findMany({
      where: {
        tenantId: tenant.id,
        occurredAt: { gte: range.from, lt: range.toExclusive },
        lead: relatedLeadWhere,
      },
      select: { type: true, occurredAt: true },
    }),
    db.interaction.findMany({
      where: {
        tenantId: tenant.id,
        occurredAt: { gte: comparisonRange.from, lt: comparisonRange.toExclusive },
        lead: relatedLeadWhere,
      },
      select: { id: true },
    }),
    db.task.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        completedAt: { gte: range.from, lt: range.toExclusive },
        lead: relatedLeadWhere,
      },
      select: { id: true },
    }),
    db.task.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        completedAt: { gte: comparisonRange.from, lt: comparisonRange.toExclusive },
        lead: relatedLeadWhere,
      },
      select: { id: true },
    }),
    db.quote.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        createdAt: { gte: range.from, lt: range.toExclusive },
        lead: relatedLeadWhere,
      },
      select: { status: true, totalAmount: true, createdAt: true },
    }),
    db.quote.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        createdAt: { gte: comparisonRange.from, lt: comparisonRange.toExclusive },
        lead: relatedLeadWhere,
      },
      select: { id: true },
    }),
  ]);

  const leads = leadsSegment as LeadReportRow[];
  const leadIds = leads.map((lead) => lead.id);

  const [tasksCurrent, quotesCurrent] = await Promise.all([
    leadIds.length === 0
      ? Promise.resolve([] as TaskReportRow[])
      : db.task.findMany({
          where: {
            tenantId: tenant.id,
            deletedAt: null,
            leadId: { in: leadIds },
          },
          select: { status: true, completedAt: true, createdAt: true },
        }),
    leadIds.length === 0
      ? Promise.resolve([] as QuoteReportRow[])
      : db.quote.findMany({
          where: {
            tenantId: tenant.id,
            deletedAt: null,
            leadId: { in: leadIds },
          },
          select: { status: true, totalAmount: true, createdAt: true },
        }),
  ]);

  const statusRows = leads.reduce(
    (acc, lead) => {
      acc[lead.status] = (acc[lead.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<LeadStatus, number>>,
  );

  const statusBuckets = buildLeadStatusBuckets(
    Object.entries(statusRows).map(([status, count]) => ({
      status: status as LeadStatus,
      _count: { _all: count ?? 0 },
    })),
  );

  const leadTrend = buildTimeSeries(
    leadsInRange.map((lead) => lead.createdAt),
    range,
  );

  const cityCounter = new Map<string, number>();
  const sourceCounter = new Map<string, number>();
  const industryCounter = new Map<string, number>();
  const ownerCounter = new Map<string, { leads: number; won: number }>();

  for (const lead of leads) {
    incrementCounter(cityCounter, lead.city);
    incrementCounter(sourceCounter, lead.source);
    incrementCounter(industryCounter, lead.industry);

    if (lead.ownerId && lead.owner) {
      const label = lead.owner.name?.trim() || lead.owner.email;
      const row = ownerCounter.get(label) ?? { leads: 0, won: 0 };
      row.leads += 1;
      if (lead.status === 'WON') row.won += 1;
      ownerCounter.set(label, row);
    }
  }

  const interactionTypeCounter = new Map<string, number>();
  for (const interaction of interactionsInRange as InteractionReportRow[]) {
    incrementCounter(interactionTypeCounter, INTERACTION_LABEL[interaction.type]);
  }

  const taskStatusCounter = new Map<string, number>();
  let openTasks = 0;
  for (const task of tasksCurrent) {
    incrementCounter(taskStatusCounter, TASK_STATUS_LABEL[task.status]);
    if (task.status === 'PENDING' || task.status === 'IN_PROGRESS') {
      openTasks += 1;
    }
  }

  const quoteStatusCounter = new Map<QuoteStatus, { value: number; amount: number }>();
  let quotePipelineAmount = 0;
  for (const quote of quotesCurrent) {
    const current = quoteStatusCounter.get(quote.status) ?? { value: 0, amount: 0 };
    current.value += 1;
    current.amount += Number(quote.totalAmount);
    quoteStatusCounter.set(quote.status, current);

    if (quote.status === 'BORRADOR' || quote.status === 'ENVIADA') {
      quotePipelineAmount += Number(quote.totalAmount);
    }
  }

  const totalLeads = leads.length;
  const won = statusRows.WON ?? 0;
  const lost = statusRows.LOST ?? 0;
  const winRate = percentage(won, won + lost);
  const newLeadsInRange = leadsInRange.length;

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
    range,
    comparisonRange,
    filters: {
      ...filters,
      scope: appliedScope,
      ownerId: appliedScope === 'mine' ? undefined : filters.ownerId,
    },
    filterOptions: {
      owners: canViewAll
        ? memberships.map((membership) => ({
            id: membership.user.id,
            label: membership.user.name?.trim() || membership.user.email,
          }))
        : [],
      sources: sourceRows
        .map((row) => row.source)
        .filter((value): value is string => Boolean(value)),
      countries: countryRows
        .map((row) => row.country)
        .filter((value): value is string => Boolean(value)),
      cities: cityRows.map((row) => row.city).filter((value): value is string => Boolean(value)),
    },
    summary: {
      totalLeads,
      newLeadsInRange,
      newLeadsInRangeDelta: computeDelta(newLeadsInRange, leadsInPreviousRange.length),
      interactionsInRange: interactionsInRange.length,
      interactionsInRangeDelta: computeDelta(
        interactionsInRange.length,
        interactionsInPreviousRange.length,
      ),
      openTasks,
      completedTasksInRange: tasksInRange.length,
      completedTasksInRangeDelta: computeDelta(tasksInRange.length, tasksInPreviousRange.length),
      quotesInRange: quotesInRange.length,
      quotesInRangeDelta: computeDelta(quotesInRange.length, quotesInPreviousRange.length),
      quotePipelineAmount,
      winRate,
    },
    statusBuckets,
    leadTrend,
    interactionTypeRows: toTopMetrics(interactionTypeCounter, 5),
    topCities: toTopMetrics(cityCounter, 6),
    topSources: toTopMetrics(sourceCounter, 6),
    topIndustries: toTopMetrics(industryCounter, 6),
    taskStatusRows: TASK_STATUS_ORDER.map((status) => ({
      label: TASK_STATUS_LABEL[status],
      value: taskStatusCounter.get(TASK_STATUS_LABEL[status]) ?? 0,
    })),
    quoteStatusRows: QUOTE_STATUS_ORDER.map((status) => ({
      label: QUOTE_STATUS_LABEL[status],
      value: quoteStatusCounter.get(status)?.value ?? 0,
      amount: quoteStatusCounter.get(status)?.amount ?? 0,
    })),
    ownerPerformance: canViewAll
      ? [...ownerCounter.entries()]
          .sort((a, b) => b[1].leads - a[1].leads || a[0].localeCompare(b[0], 'es'))
          .slice(0, 6)
          .map(([label, row]) => ({ label, leads: row.leads, won: row.won }))
      : [],
  };
}
