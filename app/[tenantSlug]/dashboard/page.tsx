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
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { buildLeadStatusBuckets, LEAD_STATUS_LABEL } from '@/lib/lead-status';
import { hasRole } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function formatDate(value: Date) {
  return value.toLocaleString('es-PE', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

  const [
    leads,
    members,
    unassignedLeads,
    pendingReassignments,
    statusRows,
    recentLeads,
    myLeads,
    dedupeLeads,
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

  const userName = session.user.name?.split(' ')[0] ?? session.user.email?.split('@')[0] ?? 'hola';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="min-w-0 space-y-8">
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

      {/* ── KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Leads totales / Mi cartera */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">
              {isManager ? 'Leads totales' : 'Mi cartera'}
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30">
              <ClipboardList className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold">{leads}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isManager ? 'Pipeline activo del tenant' : 'Leads asignados a ti'}
          </p>
        </div>

        {/* Sin owner (solo managers) */}
        {isManager && (
          <div
            className={cn(
              'rounded-xl border bg-card p-5',
              unassignedLeads > 0 && 'border-amber-200 dark:border-amber-800',
            )}
          >
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">Sin owner</p>
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
            </div>
            <p className="mt-3 text-3xl font-bold">{unassignedLeads}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {unassignedLeads > 0 ? (
                <Link
                  href={`/${tenantSlug}/leads?ownerId=unassigned&page=1`}
                  className="text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
                >
                  Cola pendiente de asignación →
                </Link>
              ) : (
                'Todos los leads tienen owner'
              )}
            </p>
          </div>
        )}

        {/* Reasignaciones (solo managers) */}
        {assignmentsEnabled && isManager && (
          <div
            className={cn(
              'rounded-xl border bg-card p-5',
              pendingReassignments > 0 && 'border-orange-200 dark:border-orange-800',
            )}
          >
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">Reasignaciones</p>
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
            </div>
            <p className="mt-3 text-3xl font-bold">{pendingReassignments}</p>
            <p className="mt-1 text-xs text-muted-foreground">Solicitudes esperando resolución</p>
          </div>
        )}

        {/* Miembros (solo managers) */}
        {isManager && (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">Miembros activos</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold">{members}</p>
            <p className="mt-1 text-xs text-muted-foreground">Equipo actualmente operativo</p>
          </div>
        )}

        {/* Duplicados (solo managers) */}
        {dedupeEnabled && isManager && (
          <div
            className={cn(
              'rounded-xl border bg-card p-5',
              duplicateSummary.totalGroups > 0 && 'border-rose-200 dark:border-rose-800',
            )}
          >
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">Duplicados</p>
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
            </div>
            <p className="mt-3 text-3xl font-bold">{duplicateSummary.totalGroups}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {duplicateSummary.totalGroups > 0 ? (
                <Link
                  href={`/${tenantSlug}/leads/dedupe`}
                  className="text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
                >
                  {duplicateSummary.totalLeadsAtRisk} lead(s) en riesgo →
                </Link>
              ) : (
                'Sin duplicados detectados'
              )}
            </p>
          </div>
        )}

        {/* Mi cartera (solo managers que no son superAdmin) */}
        {isManager && !session.user.isSuperAdmin && (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">Mi cartera</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold">{myLeads}</p>
            <p className="mt-1 text-xs text-muted-foreground">Leads con ownership directo</p>
          </div>
        )}
      </div>

      {/* ── Pipeline por estado ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Pipeline por estado</h2>
            <p className="text-xs text-muted-foreground">
              {isManager
                ? 'Distribución actual del embudo comercial.'
                : 'Distribución de tu embudo comercial.'}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${tenantSlug}/leads`}>
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

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
                {/* Progress bar */}
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
      </div>

      {/* ── Herramientas (solo managers) ── */}
      {isManager && (importEnabled || dedupeEnabled) && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Herramientas</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {importEnabled && (
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Importación masiva</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Carga leads por CSV con validación y descarte de colisiones.
                    </p>
                    <Button size="sm" className="mt-3" asChild>
                      <Link href={`/${tenantSlug}/leads/import`}>Abrir importación</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {dedupeEnabled && (
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900/30">
                    <GitMerge className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Revisión de duplicados</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Detección por RUC, email, teléfono y nombre normalizado.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
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
                    <Button size="sm" className="mt-3" asChild>
                      <Link href={`/${tenantSlug}/leads/dedupe`}>Abrir deduplicación</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Actividad reciente ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Actividad reciente</h2>
            <p className="text-xs text-muted-foreground">
              {isManager
                ? 'Últimos leads actualizados en el pipeline.'
                : 'Tus leads actualizados recientemente.'}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${tenantSlug}/leads?page=1&status=NEW`}>
              Revisar nuevos <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
              {recentLeads.map((lead, i) => {
                const Icon = STATUS_ICON[lead.status as keyof typeof STATUS_ICON];
                const ownerLabel = lead.owner?.name || lead.owner?.email || 'Sin owner';
                return (
                  <li key={lead.id}>
                    <Link
                      href={`/${tenantSlug}/leads/${lead.id}`}
                      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                    >
                      {/* Status icon */}
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                          STATUS_COLOR[lead.status],
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Lead info */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium group-hover:text-primary">
                          {lead.businessName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ownerLabel}
                          {lead.city ? ` · ${lead.city}` : ''}
                        </p>
                      </div>

                      {/* Right */}
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant="outline" className="hidden text-xs sm:inline-flex">
                          {LEAD_STATUS_LABEL[lead.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(lead.updatedAt)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </Link>
                    {i < recentLeads.length - 1 && null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Alerta leads sin owner (solo managers) ── */}
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
    </div>
  );
}
