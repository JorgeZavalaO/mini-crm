import type { FeatureKey, Prisma, QuoteStatus, TaskStatus } from '@prisma/client';
import { requireSuperAdmin } from '@/lib/auth-guard';
import { FEATURE_LABEL, SUPPORTED_FEATURE_KEYS } from '@/lib/feature-catalog';
import { db } from '@/lib/db';
import type { SuperadminReportFilters } from '@/lib/validators';
import {
  incrementCounter,
  percentage,
  resolveReportRange,
  toTopMetrics,
  type MetricDatum,
  type ResolvedReportRange,
} from '@/lib/reporting/shared';

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

const TASK_STATUS_ORDER: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const QUOTE_STATUS_ORDER: QuoteStatus[] = ['BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA'];

type SuperadminFilterOptions = {
  plans: Array<{ id: string; label: string }>;
  features: Array<{ value: FeatureKey; label: string }>;
};

export type SuperadminReportsData = {
  actor: {
    userId: string;
    userEmail: string;
  };
  range: ResolvedReportRange;
  filters: SuperadminReportFilters;
  filterOptions: SuperadminFilterOptions;
  summary: {
    tenantsInScope: number;
    activeTenants: number;
    usersInScope: number;
    leadsInRange: number;
    interactionsInRange: number;
    openTasks: number;
    quotesInRange: number;
    quoteVolume: number;
    quoteAcceptanceRate: number;
  };
  tenantLifecycleRows: MetricDatum[];
  planDistribution: MetricDatum[];
  featureAdoption: MetricDatum[];
  topTenantsByLeads: MetricDatum[];
  taskStatusRows: MetricDatum[];
  quoteStatusRows: Array<{ label: string; value: number; amount: number }>;
};

function buildTenantWhere(filters: SuperadminReportFilters): Prisma.TenantWhereInput {
  const stateWhere: Prisma.TenantWhereInput =
    filters.tenantState === 'active'
      ? { deletedAt: null, isActive: true }
      : filters.tenantState === 'inactive'
        ? { deletedAt: null, isActive: false }
        : filters.tenantState === 'deleted'
          ? { deletedAt: { not: null } }
          : {};

  return {
    ...stateWhere,
    ...(filters.planId ? { planId: filters.planId } : {}),
    ...(filters.featureKey
      ? {
          features: {
            some: {
              featureKey: filters.featureKey,
              enabled: true,
            },
          },
        }
      : {}),
  };
}

export async function getSuperadminReportsData(
  filters: SuperadminReportFilters,
): Promise<SuperadminReportsData> {
  const session = await requireSuperAdmin();
  const range = resolveReportRange(filters);
  const tenantWhere = buildTenantWhere(filters);

  const [plans, tenants] = await Promise.all([
    db.plan.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.tenant.findMany({
      where: tenantWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        deletedAt: true,
        plan: { select: { id: true, name: true } },
        features: {
          where: { enabled: true },
          select: { featureKey: true },
        },
      },
    }),
  ]);

  const tenantIds = tenants.map((tenant) => tenant.id);

  const [memberships, leadRows, interactionRows, taskRows, quoteRows] = await Promise.all([
    tenantIds.length === 0
      ? Promise.resolve([] as Array<{ userId: string; isActive: boolean }>)
      : db.membership.findMany({
          where: { tenantId: { in: tenantIds } },
          select: { userId: true, isActive: true },
        }),
    tenantIds.length === 0
      ? Promise.resolve([] as Array<{ tenantId: string }>)
      : db.lead.findMany({
          where: {
            tenantId: { in: tenantIds },
            deletedAt: null,
            createdAt: { gte: range.from, lt: range.toExclusive },
          },
          select: { tenantId: true },
        }),
    tenantIds.length === 0
      ? Promise.resolve([] as Array<{ tenantId: string }>)
      : db.interaction.findMany({
          where: {
            tenantId: { in: tenantIds },
            occurredAt: { gte: range.from, lt: range.toExclusive },
          },
          select: { tenantId: true },
        }),
    tenantIds.length === 0
      ? Promise.resolve([] as Array<{ status: TaskStatus }>)
      : db.task.findMany({
          where: {
            tenantId: { in: tenantIds },
            deletedAt: null,
          },
          select: { status: true },
        }),
    tenantIds.length === 0
      ? Promise.resolve([] as Array<{ status: QuoteStatus; totalAmount: Prisma.Decimal }>)
      : db.quote.findMany({
          where: {
            tenantId: { in: tenantIds },
            deletedAt: null,
            createdAt: { gte: range.from, lt: range.toExclusive },
          },
          select: { status: true, totalAmount: true },
        }),
  ]);

  const activeMembershipUserIds = new Set(
    memberships.filter((membership) => membership.isActive).map((membership) => membership.userId),
  );

  const lifecycleCounter = new Map<string, number>();
  const planCounter = new Map<string, number>();
  const featureCounter = new Map<string, number>();

  for (const tenant of tenants) {
    incrementCounter(
      lifecycleCounter,
      tenant.deletedAt ? 'Dados de baja' : tenant.isActive ? 'Activos' : 'Inactivos',
    );
    incrementCounter(planCounter, tenant.plan?.name ?? 'Sin plan');

    for (const feature of tenant.features) {
      incrementCounter(featureCounter, FEATURE_LABEL[feature.featureKey]);
    }
  }

  const leadCounterByTenant = new Map<string, number>();
  for (const lead of leadRows) {
    incrementCounter(leadCounterByTenant, lead.tenantId);
  }

  const taskStatusCounter = new Map<string, number>();
  let openTasks = 0;
  for (const task of taskRows) {
    incrementCounter(taskStatusCounter, TASK_STATUS_LABEL[task.status]);
    if (task.status === 'PENDING' || task.status === 'IN_PROGRESS') {
      openTasks += 1;
    }
  }

  const quoteStatusCounter = new Map<QuoteStatus, { value: number; amount: number }>();
  let acceptedQuotes = 0;
  let rejectedQuotes = 0;
  let quoteVolume = 0;

  for (const quote of quoteRows) {
    const current = quoteStatusCounter.get(quote.status) ?? { value: 0, amount: 0 };
    current.value += 1;
    current.amount += Number(quote.totalAmount);
    quoteStatusCounter.set(quote.status, current);
    quoteVolume += Number(quote.totalAmount);

    if (quote.status === 'ACEPTADA') acceptedQuotes += 1;
    if (quote.status === 'RECHAZADA') rejectedQuotes += 1;
  }

  const topTenantsByLeads = tenants
    .map((tenant) => ({
      label: tenant.name,
      value: leadCounterByTenant.get(tenant.id) ?? 0,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'))
    .slice(0, 8);

  return {
    actor: {
      userId: session.user.id,
      userEmail: session.user.email ?? '',
    },
    range,
    filters,
    filterOptions: {
      plans: plans.map((plan) => ({ id: plan.id, label: plan.name })),
      features: SUPPORTED_FEATURE_KEYS.map((featureKey) => ({
        value: featureKey,
        label: FEATURE_LABEL[featureKey],
      })),
    },
    summary: {
      tenantsInScope: tenants.length,
      activeTenants: tenants.filter((tenant) => tenant.deletedAt === null && tenant.isActive)
        .length,
      usersInScope: activeMembershipUserIds.size,
      leadsInRange: leadRows.length,
      interactionsInRange: interactionRows.length,
      openTasks,
      quotesInRange: quoteRows.length,
      quoteVolume,
      quoteAcceptanceRate: percentage(acceptedQuotes, acceptedQuotes + rejectedQuotes),
    },
    tenantLifecycleRows: [
      { label: 'Activos', value: lifecycleCounter.get('Activos') ?? 0 },
      { label: 'Inactivos', value: lifecycleCounter.get('Inactivos') ?? 0 },
      { label: 'Dados de baja', value: lifecycleCounter.get('Dados de baja') ?? 0 },
    ],
    planDistribution: toTopMetrics(planCounter, 8),
    featureAdoption: SUPPORTED_FEATURE_KEYS.map((featureKey) => ({
      label: FEATURE_LABEL[featureKey],
      value: featureCounter.get(FEATURE_LABEL[featureKey]) ?? 0,
    })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es')),
    topTenantsByLeads,
    taskStatusRows: TASK_STATUS_ORDER.map((status) => ({
      label: TASK_STATUS_LABEL[status],
      value: taskStatusCounter.get(TASK_STATUS_LABEL[status]) ?? 0,
    })),
    quoteStatusRows: QUOTE_STATUS_ORDER.map((status) => ({
      label: QUOTE_STATUS_LABEL[status],
      value: quoteStatusCounter.get(status)?.value ?? 0,
      amount: quoteStatusCounter.get(status)?.amount ?? 0,
    })),
  };
}
