import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileUp,
  GitMerge,
  Inbox,
  Phone,
  Shuffle,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { buildDuplicateGroupsByCriterion, summarizeDuplicateGroups } from '@/lib/dedupe-utils';
import { formatDateTime } from '@/lib/date-utils';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { buildLeadStatusBuckets, LEAD_STATUS_LABEL } from '@/lib/lead-status';
import { hasRole } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadsTrendChart, type MonthlyDataPoint } from '@/components/dashboard/leads-trend-chart';
import { PipelineBarChart } from '@/components/dashboard/pipeline-bar-chart';

const STATUS_ICON = {
  NEW: Inbox,
  CONTACTED: Phone,
  QUALIFIED: CheckCircle2,
  WON: TrendingUp,
  LOST: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  NEW: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30',
  CONTACTED: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
  QUALIFIED: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
  WON: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  LOST: 'text-red-600 bg-red-100 dark:bg-red-900/30',
};

const STATUS_BAR_COLOR: Record<string, string> = {
  NEW: 'bg-sky-500',
  CONTACTED: 'bg-violet-500',
  QUALIFIED: 'bg-emerald-500',
  WON: 'bg-green-500',
  LOST: 'bg-red-400',
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant, membership, session } = await requireTenantFeature(tenantSlug, 'DASHBOARD');
  const [assignmentsEnabled, importEnabled, dedupeEnabled] = await Promise.all([
    isTenantFeatureEnabled(tenant.id, 'ASSIGNMENTS'),
    isTenantFeatureEnabled(tenant.id, 'IMPORT'),
    isTenantFeatureEnabled(tenant.id, 'DEDUPE'),
  ]);

  const isManager = session.user.isSuperAdmin || hasRole(membership?.role, 'SUPERVISOR');

  // Últimos 3 meses + mes actual para el gráfico de tendencia
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const [
    leads,
    members,
    unassignedLeads,
    pendingReassignments,
    statusRows,
    recentLeads,
    myLeads,
    dedupeLeads,
    leadsByMonth,
  ] = await Promise.all([
    isManager
      ? db.lead.count({ where: { tenantId: tenant.id, deletedAt: null } })
      : db.lead.count({
          where: { tenantId: tenant.id, deletedAt: null, ownerId: session.user.id },
        }),
    isManager
      ? db.membership.count({ where: { tenantId: tenant.id, isActive: true } })
      : Promise.resolve(0),
    isManager
      ? db.lead.count({ where: { tenantId: tenant.id, deletedAt: null, ownerId: null } })
      : Promise.resolve(0),
    assignmentsEnabled && isManager
      ? db.leadReassignmentRequest.count({
          where: { tenantId: tenant.id, status: 'PENDING' },
        })
      : Promise.resolve(0),
    isManager
      ? db.lead.groupBy({
          by: ['status'],
          where: { tenantId: tenant.id, deletedAt: null },
          _count: { _all: true },
        })
      : db.lead.groupBy({
          by: ['status'],
          where: { tenantId: tenant.id, deletedAt: null, ownerId: session.user.id },
          _count: { _all: true },
        }),
    db.lead.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        ...(!isManager ? { ownerId: session.user.id } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        businessName: true,
        status: true,
        city: true,
        updatedAt: true,
        owner: { select: { name: true, email: true } },
      },
    }),
    session.user.isSuperAdmin
      ? Promise.resolve(0)
      : db.lead.count({
          where: { tenantId: tenant.id, deletedAt: null, ownerId: session.user.id },
        }),
    dedupeEnabled && isManager
      ? db.lead.findMany({
          where: { tenantId: tenant.id, deletedAt: null },
          orderBy: { updatedAt: 'asc' },
          select: {
            id: true,
            businessName: true,
            ruc: true,
            rucNormalized: true,
            nameNormalized: true,
            country: true,
            city: true,
            industry: true,
            source: true,
            notes: true,
            phones: true,
            emails: true,
            status: true,
            ownerId: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    // Leads creados en los últimos 3 meses + mes actual (agrupados por mes en JS)
    isManager
      ? db.lead.findMany({
          where: {
            tenantId: tenant.id,
            deletedAt: null,
            createdAt: { gte: threeMonthsAgo },
          },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : db.lead.findMany({
          where: {
            tenantId: tenant.id,
            deletedAt: null,
            ownerId: session.user.id,
            createdAt: { gte: threeMonthsAgo },
          },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
  ]);

  const displayRole = membership?.role ?? (session.user.isSuperAdmin ? 'SUPERADMIN' : '—');
  const statusBuckets = buildLeadStatusBuckets(statusRows);
  const duplicateSummary = dedupeEnabled
    ? summarizeDuplicateGroups(buildDuplicateGroupsByCriterion(dedupeLeads))
    : {
        totalGroups: 0,
        totalLeadsAtRisk: 0,
        byCriterion: { RUC: 0, EMAIL: 0, PHONE: 0, NAME: 0 },
      };

  // Construir puntos de tendencia mensual (últimos 3 meses + mes actual)
  const monthlyMap = new Map<string, number>();
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('es-PE', {
      month: 'long',
      year: 'numeric',
      timeZone: tenant.companyTimezone,
    });
    monthlyMap.set(key, 0);
  }
  for (const lead of leadsByMonth) {
    const key = lead.createdAt.toLocaleDateString('es-PE', {
      month: 'long',
      year: 'numeric',
      timeZone: tenant.companyTimezone,
    });
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
  }
  const trendData: MonthlyDataPoint[] = Array.from(monthlyMap.entries()).map(([month, leads]) => ({
    month,
    leads,
  }));

  const userName = session.user.name?.split(' ')[0] ?? session.user.email?.split('@')[0] ?? 'hola';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="min-w-0 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting}, <span className="font-medium text-foreground">{userName}</span>
          </p>
          <h1 className="mt-0.5 text-2xl font-bold">{tenant.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {displayRole}
            </Badge>
            <span className="text-xs text-muted-foreground">/{tenantSlug}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {importEnabled && isManager && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${tenantSlug}/leads/import`}>
                <FileUp className="mr-1.5 h-3.5 w-3.5" />
                Importar
              </Link>
            </Button>
          )}
          {dedupeEnabled && isManager && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${tenantSlug}/leads/dedupe`}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Duplicados
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href={`/${tenantSlug}/leads`}>
              Ver pipeline
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Alerta leads sin owner ── */}
      {isManager && unassignedLeads > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-300">
              {unassignedLeads} lead{unassignedLeads > 1 ? 's' : ''} sin asignar.
            </span>{' '}
            <span className="text-amber-700 dark:text-amber-400">
              Revisa la cola de asignación para evitar pérdidas de oportunidades.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
            asChild
          >
            <Link href={`/${tenantSlug}/leads`}>Asignar</Link>
          </Button>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Leads totales / Mi cartera */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isManager ? 'Leads totales' : 'Mi cartera'}
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30">
              <ClipboardList className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{leads}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isManager ? 'Pipeline activo del tenant' : 'Leads asignados a ti'}
            </p>
          </CardContent>
        </Card>

        {/* Sin owner (solo managers) */}
        {isManager && (
          <Card className={cn(unassignedLeads > 0 && 'border-amber-200 dark:border-amber-800')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sin responsable
              </CardTitle>
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  unassignedLeads > 0
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <UserCheck className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{unassignedLeads}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {unassignedLeads > 0 ? (
                  <Link
                    href={`/${tenantSlug}/leads?ownerId=unassigned&page=1`}
                    className="text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
                  >
                    Cola pendiente →
                  </Link>
                ) : (
                  'Todos tienen owner'
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reasignaciones (solo managers) */}
        {/* {assignmentsEnabled && isManager && (
          <Card
            className={cn(pendingReassignments > 0 && 'border-orange-200 dark:border-orange-800')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reasignaciones
              </CardTitle>
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  pendingReassignments > 0
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <Shuffle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{pendingReassignments}</p>
              <p className="mt-1 text-xs text-muted-foreground">Solicitudes pendientes</p>
            </CardContent>
          </Card>
        )} */}

        {/* Miembros (solo managers) */}
        {isManager && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Miembros activos
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{members}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <Link
                  href={`/${tenantSlug}/team`}
                  className="underline-offset-2 hover:underline hover:text-primary"
                >
                  Ver equipo →
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Mi cartera (solo managers que no son superAdmin) */}
        {isManager && !session.user.isSuperAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mi cartera
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30">
                <Building2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{myLeads}</p>
              <p className="mt-1 text-xs text-muted-foreground">Con ownership directo</p>
            </CardContent>
          </Card>
        )}

        {/* Duplicados (solo managers) */}
        {/* {dedupeEnabled && isManager && (
          <Card
            className={cn(
              duplicateSummary.totalGroups > 0 && 'border-rose-200 dark:border-rose-800',
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Duplicados
              </CardTitle>
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  duplicateSummary.totalGroups > 0
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <GitMerge className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{duplicateSummary.totalGroups}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {duplicateSummary.totalGroups > 0 ? (
                  <Link
                    href={`/${tenantSlug}/leads/dedupe`}
                    className="text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
                  >
                    {duplicateSummary.totalLeadsAtRisk} en riesgo →
                  </Link>
                ) : (
                  'Sin duplicados'
                )}
              </p>
            </CardContent>
          </Card>
        )} */}
      </div>

      {/* ── Gráficos ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline por estado — Barras */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Pipeline por estado</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${tenantSlug}/leads`}>
                  Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isManager ? 'Distribución del embudo comercial.' : 'Tu distribución del embudo.'}
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <PipelineBarChart buckets={statusBuckets} />
          </CardContent>
        </Card>

        {/* Tendencia mensual — Área */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tendencia de leads</CardTitle>
            <p className="text-xs text-muted-foreground">
              Leads captados mes a mes en los últimos 4 meses.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <LeadsTrendChart data={trendData} lastUpdated={now} />
          </CardContent>
        </Card>
      </div>

      {/* ── Pipeline — tarjetas de estado (clickeable) ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statusBuckets.map((bucket) => {
          const pct = leads === 0 ? 0 : Math.round((bucket.count / leads) * 100);
          const Icon = STATUS_ICON[bucket.status as keyof typeof STATUS_ICON];
          return (
            <Link
              key={bucket.status}
              href={`/${tenantSlug}/leads?status=${bucket.status}&page=1`}
              className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    STATUS_COLOR[bucket.status],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xl font-bold">{bucket.count}</span>
              </div>
              <p className="mt-3 text-xs font-medium">{bucket.label}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    STATUS_BAR_COLOR[bucket.status],
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{pct}% del total</p>
            </Link>
          );
        })}
      </div>

      {/* ── Actividad reciente + Herramientas ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Actividad reciente — 2/3 del ancho */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Actividad reciente</h2>
              <p className="text-xs text-muted-foreground">
                {isManager
                  ? 'Últimos leads actualizados en el pipeline.'
                  : 'Tus leads actualizados recientemente.'}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${tenantSlug}/leads?page=1&status=NEW`}>
                Nuevos <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border bg-card">
            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Aún no hay leads activos.</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/${tenantSlug}/leads`}>Ir al pipeline</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {recentLeads.map((lead) => {
                  const Icon = STATUS_ICON[lead.status as keyof typeof STATUS_ICON];
                  const ownerLabel = lead.owner?.name || lead.owner?.email || 'Sin responsable';
                  return (
                    <li key={lead.id}>
                      <Link
                        href={`/${tenantSlug}/leads/${lead.id}`}
                        className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                      >
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                            STATUS_COLOR[lead.status],
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium group-hover:text-primary">
                            {lead.businessName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {ownerLabel}
                            {lead.city ? ` · ${lead.city}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <Badge variant="outline" className="hidden text-xs sm:inline-flex">
                            {LEAD_STATUS_LABEL[lead.status]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(lead.updatedAt, tenant.companyTimezone)}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Herramientas — 1/3 del ancho */}
        {isManager && (importEnabled || dedupeEnabled) && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Herramientas</h2>
            <div className="flex flex-col gap-4">
              {importEnabled && (
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30">
                        <FileUp className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Importación masiva</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Carga leads por CSV o Excel.
                        </p>
                        <Button size="sm" className="mt-3 w-full" variant="outline" asChild>
                          <Link href={`/${tenantSlug}/leads/import`}>Abrir</Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {dedupeEnabled && (
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900/30">
                        <GitMerge className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Duplicados</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">
                            RUC: {duplicateSummary.byCriterion.RUC}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Email: {duplicateSummary.byCriterion.EMAIL}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Tel: {duplicateSummary.byCriterion.PHONE}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Nombre: {duplicateSummary.byCriterion.NAME}
                          </Badge>
                        </div>
                        <Button size="sm" className="mt-3 w-full" variant="outline" asChild>
                          <Link href={`/${tenantSlug}/leads/dedupe`}>Revisar</Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
