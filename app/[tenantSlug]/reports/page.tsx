import Link from 'next/link';
import {
  BarChart3,
  CheckSquare,
  MessageSquare,
  ScrollText,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { CategoryBarChart } from '@/components/reports/category-bar-chart';
import { ReportExportButton } from '@/components/reports/report-export-button';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportStatCard } from '@/components/reports/report-stat-card';
import { TimeSeriesAreaChart } from '@/components/reports/time-series-area-chart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { firstSearchParam } from '@/lib/pagination';
import { compactNumber, formatDateInput } from '@/lib/reporting/shared';
import { getTenantReportsData } from '@/lib/reporting/tenant-reports';
import { normalizeReportDateRange, tenantReportFiltersSchema } from '@/lib/validators';

function MetricList({
  items,
  emptyLabel,
  valueFormatter,
}: {
  items: Array<{ label: string; value: number }>;
  emptyLabel: string;
  valueFormatter?: (value: number) => string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-muted-foreground">{item.label}</span>
          <span className="font-semibold text-foreground">
            {valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString('es-PE')}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RankedMetricList({
  items,
  emptyLabel,
  barColor = 'bg-primary',
}: {
  items: Array<{ label: string; value: number }>;
  emptyLabel: string;
  barColor?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{item.label}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {Math.round((item.value / total) * 100)}%
              </span>
              <span className="w-8 text-right font-semibold tabular-nums">
                {item.value.toLocaleString('es-PE')}
              </span>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${barColor} transition-all`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const TASK_STATUS_DOT: Record<string, string> = {
  Pendientes: 'bg-amber-500',
  'En progreso': 'bg-blue-500',
  Completadas: 'bg-emerald-500',
  Canceladas: 'bg-slate-400',
};

const QUOTE_STATUS_DOT: Record<string, string> = {
  Borrador: 'bg-slate-400',
  Enviada: 'bg-blue-500',
  Aceptada: 'bg-emerald-500',
  Rechazada: 'bg-red-500',
};

export default async function TenantReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;
  const today = new Date();

  const parsedFilters = tenantReportFiltersSchema.safeParse({
    tenantSlug,
    preset: firstSearchParam(rawSearchParams.preset) ?? 'custom',
    from: firstSearchParam(rawSearchParams.from),
    to: firstSearchParam(rawSearchParams.to),
    scope: firstSearchParam(rawSearchParams.scope) ?? 'all',
    ownerId: firstSearchParam(rawSearchParams.ownerId),
    status: firstSearchParam(rawSearchParams.status),
    source: firstSearchParam(rawSearchParams.source),
    country: firstSearchParam(rawSearchParams.country),
    city: firstSearchParam(rawSearchParams.city),
    page: firstSearchParam(rawSearchParams.page) ?? '1',
    pageSize: firstSearchParam(rawSearchParams.pageSize) ?? '20',
  });

  const filters = parsedFilters.success
    ? normalizeReportDateRange(parsedFilters.data)
    : normalizeReportDateRange(
        tenantReportFiltersSchema.parse({
          tenantSlug,
          preset: 'custom',
          from: today,
          to: today,
          scope: 'all',
        }),
      );

  const data = await getTenantReportsData(filters);
  const basePath = `/${tenantSlug}/reports`;
  const exportPayload = {
    tenantSlug,
    preset: data.filters.preset,
    from: data.filters.from ?? null,
    to: data.filters.to ?? null,
    scope: data.filters.scope,
    ownerId: data.filters.ownerId,
    status: data.filters.status,
    source: data.filters.source,
    country: data.filters.country,
    city: data.filters.city,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
            <Badge variant="secondary">{data.range.label}</Badge>
            <Badge variant="outline">
              {data.actor.appliedScope === 'mine' ? 'Mi vista' : 'Todo el tenant'}
            </Badge>
            <Badge variant="outline" className="border-dashed text-muted-foreground">
              Comparado: {data.comparisonRange.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Indicadores operativos, comerciales y de seguimiento para {data.tenant.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportExportButton mode="tenant" payload={exportPayload} label="Exportar reporte" />
          <Link
            href={`/${tenantSlug}/dashboard`}
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Volver al tablero
          </Link>
        </div>
      </div>

      <ReportFilters
        mode="tenant"
        basePath={basePath}
        canViewAll={data.actor.canViewAll}
        filters={{
          preset: data.filters.preset,
          from: data.filters.from ? formatDateInput(data.filters.from) : undefined,
          to: data.filters.to ? formatDateInput(data.filters.to) : undefined,
          scope: data.filters.scope,
          ownerId: data.filters.ownerId,
          status: data.filters.status,
          source: data.filters.source,
          country: data.filters.country,
          city: data.filters.city,
        }}
        options={data.filterOptions}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <ReportStatCard
          title="Leads segmentados"
          value={compactNumber(data.summary.totalLeads)}
          description="Base actual filtrada para este reporte."
          icon={Target}
          tone="default"
          scopeLabel="Estado actual"
        />
        <ReportStatCard
          title="Nuevos en rango"
          value={compactNumber(data.summary.newLeadsInRange)}
          description="Leads creados dentro del periodo activo."
          icon={TrendingUp}
          tone="success"
          scopeLabel="Periodo"
          delta={data.summary.newLeadsInRangeDelta}
        />
        <ReportStatCard
          title="Win rate"
          value={`${data.summary.winRate}%`}
          description="Ganados sobre leads cerrados (ganado/perdido)."
          icon={BarChart3}
          tone="accent"
          scopeLabel="Estado actual"
        />
        <ReportStatCard
          title="Interacciones"
          value={compactNumber(data.summary.interactionsInRange)}
          description={`${data.interactionsByType.calls} llamadas, ${data.interactionsByType.whatsapp} WhatsApp, ${data.interactionsByType.emails} correos, ${data.interactionsByType.visits} visitas, ${data.interactionsByType.notes} notas`}
          icon={MessageSquare}
          tone="info"
          scopeLabel="Periodo"
          delta={data.summary.interactionsInRangeDelta}
        />
        <ReportStatCard
          title="Tareas abiertas"
          value={compactNumber(data.summary.openTasks)}
          description="Pendientes o en progreso sobre leads filtrados."
          icon={CheckSquare}
          tone="warning"
          scopeLabel="Estado actual"
        />
        <ReportStatCard
          title="Cotizaciones"
          value={compactNumber(data.summary.quotesInRange)}
          description="Cotizaciones creadas dentro del periodo."
          icon={ScrollText}
          tone="default"
          scopeLabel="Periodo"
          delta={data.summary.quotesInRangeDelta}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendencia de captación</CardTitle>
            <p className="text-sm text-muted-foreground">
              Evolución de leads creados dentro del rango seleccionado.
            </p>
          </CardHeader>
          <CardContent>
            <TimeSeriesAreaChart data={data.leadTrend} seriesLabel="Leads" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución del pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Foto actual del embudo para el segmento activo.
            </p>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={data.statusBuckets.map((bucket) => ({
                label: bucket.label,
                value: bucket.count,
              }))}
              seriesLabel="Leads"
              color="hsl(var(--chart-2))"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividad por canal</CardTitle>
            <p className="text-sm text-muted-foreground">
              Cómo se está moviendo el seguimiento en el periodo.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryBarChart
              data={data.interactionTypeRows}
              seriesLabel="Interacciones"
              color="hsl(var(--chart-3))"
            />
            <MetricList
              items={data.interactionTypeRows}
              emptyLabel="No hay interacciones para este rango."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Indicadores de clientes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ciudades, fuentes e industrias con mayor peso en el segmento.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top ciudades
              </p>
              <RankedMetricList
                items={data.topCities}
                emptyLabel="Sin ciudades registradas."
                barColor="bg-sky-500"
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top fuentes
              </p>
              <RankedMetricList
                items={data.topSources}
                emptyLabel="Sin fuentes registradas."
                barColor="bg-violet-500"
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top industrias
              </p>
              <RankedMetricList
                items={data.topIndustries}
                emptyLabel="Sin industrias registradas."
                barColor="bg-amber-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operación relacionada</CardTitle>
            <p className="text-sm text-muted-foreground">
              Estado actual de tareas y cotizaciones ligadas al segmento filtrado.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tareas
              </p>
              {(() => {
                const totalTasks = data.taskStatusRows.reduce((s, r) => s + r.value, 0);
                if (totalTasks === 0) {
                  return <p className="text-sm text-muted-foreground">Sin tareas relacionadas.</p>;
                }
                return (
                  <ul className="space-y-2.5">
                    {data.taskStatusRows.map((row) => {
                      const pct = Math.round((row.value / totalTasks) * 100);
                      const dot = TASK_STATUS_DOT[row.label] ?? 'bg-muted-foreground';
                      return (
                        <li key={row.label}>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                              <span className="text-foreground">{row.label}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                              <span className="w-6 text-right font-semibold tabular-nums">
                                {row.value}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${dot} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cotizaciones
              </p>
              {(() => {
                const totalQuotes = data.quoteStatusRows.reduce((s, r) => s + r.value, 0);
                const totalAmount = data.quoteStatusRows.reduce((s, r) => s + r.amount, 0);
                if (totalQuotes === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">Sin cotizaciones relacionadas.</p>
                  );
                }
                return (
                  <div className="space-y-4">
                    <ul className="space-y-2.5">
                      {data.quoteStatusRows.map((row) => {
                        const pct = Math.round((row.value / totalQuotes) * 100);
                        const dot = QUOTE_STATUS_DOT[row.label] ?? 'bg-muted-foreground';
                        return (
                          <li key={row.label}>
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                                <span>{row.label}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                {row.amount > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    S/{' '}
                                    {row.amount.toLocaleString('es-PE', {
                                      maximumFractionDigits: 0,
                                    })}
                                  </span>
                                )}
                                <span className="w-6 text-right font-semibold tabular-nums">
                                  {row.value}
                                </span>
                              </div>
                            </div>
                            {row.value > 0 && (
                              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${dot} transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {totalAmount > 0 && (
                      <div className="flex items-center justify-between border-t pt-2 text-sm">
                        <span className="text-muted-foreground">Total pipeline</span>
                        <span className="font-semibold">
                          S/ {totalAmount.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.ownerPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desempeño del equipo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Vista rápida de leads y cierres por responsable dentro del segmento.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Responsable</th>
                    <th className="py-2 pr-4 font-medium">Leads</th>
                    <th className="py-2 font-medium">Ganados</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ownerPerformance.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{row.label}</td>
                      <td className="py-3 pr-4">{row.leads.toLocaleString('es-PE')}</td>
                      <td className="py-3">{row.won.toLocaleString('es-PE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.summary.totalLeads === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No hay leads para el filtro actual</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Prueba ampliando el rango o limpiando la segmentación para revisar más actividad.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
