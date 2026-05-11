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
import { tenantReportFiltersSchema } from '@/lib/validators';

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

export default async function TenantReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;

  const parsedFilters = tenantReportFiltersSchema.safeParse({
    tenantSlug,
    preset: firstSearchParam(rawSearchParams.preset) ?? '30d',
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
    ? parsedFilters.data
    : tenantReportFiltersSchema.parse({ tenantSlug, preset: '30d', scope: 'all' });

  const data = await getTenantReportsData(filters);
  const basePath = `/${tenantSlug}/reports`;
  const exportPayload = {
    tenantSlug,
    preset: firstSearchParam(rawSearchParams.preset) ?? data.filters.preset,
    from: firstSearchParam(rawSearchParams.from),
    to: firstSearchParam(rawSearchParams.to),
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
          from: firstSearchParam(rawSearchParams.from) ?? formatDateInput(data.range.from),
          to: firstSearchParam(rawSearchParams.to) ?? formatDateInput(data.range.to),
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
        />
        <ReportStatCard
          title="Nuevos en rango"
          value={compactNumber(data.summary.newLeadsInRange)}
          description="Leads creados dentro del periodo activo."
          icon={TrendingUp}
          tone="success"
        />
        <ReportStatCard
          title="Win rate"
          value={`${data.summary.winRate}%`}
          description="Ganados sobre leads cerrados (ganado/perdido)."
          icon={BarChart3}
          tone="accent"
        />
        <ReportStatCard
          title="Interacciones"
          value={compactNumber(data.summary.interactionsInRange)}
          description="Actividad registrada dentro del periodo."
          icon={MessageSquare}
          tone="info"
        />
        <ReportStatCard
          title="Tareas abiertas"
          value={compactNumber(data.summary.openTasks)}
          description="Pendientes o en progreso sobre leads filtrados."
          icon={CheckSquare}
          tone="warning"
        />
        <ReportStatCard
          title="Cotizaciones"
          value={compactNumber(data.summary.quotesInRange)}
          description="Cotizaciones creadas dentro del periodo."
          icon={ScrollText}
          tone="default"
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
              <MetricList items={data.topCities} emptyLabel="Sin ciudades registradas." />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top fuentes
              </p>
              <MetricList items={data.topSources} emptyLabel="Sin fuentes registradas." />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top industrias
              </p>
              <MetricList items={data.topIndustries} emptyLabel="Sin industrias registradas." />
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
              <MetricList items={data.taskStatusRows} emptyLabel="Sin tareas relacionadas." />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cotizaciones
              </p>
              {data.quoteStatusRows.every((row) => row.value === 0) ? (
                <p className="text-sm text-muted-foreground">Sin cotizaciones relacionadas.</p>
              ) : (
                <ul className="space-y-3">
                  {data.quoteStatusRows.map((row) => (
                    <li key={row.label} className="space-y-1.5 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{row.label}</span>
                        <span className="font-semibold">{row.value.toLocaleString('es-PE')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Monto nominal:{' '}
                        {row.amount.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
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
