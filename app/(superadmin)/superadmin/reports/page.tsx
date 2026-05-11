import Link from 'next/link';
import { BarChart3, Building2, Layers, MessageSquare, ScrollText, Users } from 'lucide-react';
import { CategoryBarChart } from '@/components/reports/category-bar-chart';
import { ReportExportButton } from '@/components/reports/report-export-button';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportStatCard } from '@/components/reports/report-stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { firstSearchParam } from '@/lib/pagination';
import { compactNumber, formatDateInput } from '@/lib/reporting/shared';
import { getSuperadminReportsData } from '@/lib/reporting/superadmin-reports';
import { superadminReportFiltersSchema } from '@/lib/validators';

function MetricList({
  items,
  emptyLabel,
}: {
  items: Array<{ label: string; value: number }>;
  emptyLabel: string;
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
            {item.value.toLocaleString('es-PE')}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function SuperadminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSearchParams = await searchParams;

  const parsedFilters = superadminReportFiltersSchema.safeParse({
    preset: firstSearchParam(rawSearchParams.preset) ?? '30d',
    from: firstSearchParam(rawSearchParams.from),
    to: firstSearchParam(rawSearchParams.to),
    tenantState: firstSearchParam(rawSearchParams.tenantState) ?? 'all',
    planId: firstSearchParam(rawSearchParams.planId),
    featureKey: firstSearchParam(rawSearchParams.featureKey),
    page: firstSearchParam(rawSearchParams.page) ?? '1',
    pageSize: firstSearchParam(rawSearchParams.pageSize) ?? '20',
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : superadminReportFiltersSchema.parse({ preset: '30d', tenantState: 'all' });

  const data = await getSuperadminReportsData(filters);
  const basePath = '/superadmin/reports';
  const exportPayload = {
    preset: firstSearchParam(rawSearchParams.preset) ?? data.filters.preset,
    from: firstSearchParam(rawSearchParams.from),
    to: firstSearchParam(rawSearchParams.to),
    tenantState: data.filters.tenantState,
    planId: data.filters.planId,
    featureKey: data.filters.featureKey,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Reportes globales</h1>
            <Badge variant="secondary">{data.range.label}</Badge>
            <Badge variant="outline">Superadmin</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Vista consolidada del sistema, adopción de módulos y actividad por tenant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportExportButton
            mode="superadmin"
            payload={exportPayload}
            label="Exportar reporte global"
          />
          <Link
            href="/superadmin"
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Volver al panel
          </Link>
        </div>
      </div>

      <ReportFilters
        mode="superadmin"
        basePath={basePath}
        filters={{
          preset: data.filters.preset,
          from: firstSearchParam(rawSearchParams.from) ?? formatDateInput(data.range.from),
          to: firstSearchParam(rawSearchParams.to) ?? formatDateInput(data.range.to),
          tenantState: data.filters.tenantState,
          planId: data.filters.planId,
          featureKey: data.filters.featureKey,
        }}
        options={data.filterOptions}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <ReportStatCard
          title="Tenants"
          value={compactNumber(data.summary.tenantsInScope)}
          description="Empresas dentro del alcance filtrado."
          icon={Building2}
          tone="default"
        />
        <ReportStatCard
          title="Tenants activos"
          value={compactNumber(data.summary.activeTenants)}
          description="Tenants activos y no dados de baja."
          icon={Layers}
          tone="success"
        />
        <ReportStatCard
          title="Usuarios activos"
          value={compactNumber(data.summary.usersInScope)}
          description="Miembros activos pertenecientes al alcance."
          icon={Users}
          tone="accent"
        />
        <ReportStatCard
          title="Leads en rango"
          value={compactNumber(data.summary.leadsInRange)}
          description="Captación consolidada del periodo."
          icon={BarChart3}
          tone="info"
        />
        <ReportStatCard
          title="Interacciones"
          value={compactNumber(data.summary.interactionsInRange)}
          description="Actividad registrada en el periodo."
          icon={MessageSquare}
          tone="info"
        />
        <ReportStatCard
          title="Aceptación quotes"
          value={`${data.summary.quoteAcceptanceRate}%`}
          description="Aceptadas sobre quotes cerradas del periodo."
          icon={ScrollText}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución por plan</CardTitle>
            <p className="text-sm text-muted-foreground">
              Cómo se reparte la base actual de tenants entre los planes disponibles.
            </p>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={data.planDistribution}
              seriesLabel="Tenants"
              color="hsl(var(--chart-2))"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adopción de módulos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Cuántos tenants habilitaron cada módulo soportado.
            </p>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={data.featureAdoption}
              seriesLabel="Tenants"
              color="hsl(var(--chart-4))"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado de tenants</CardTitle>
            <p className="text-sm text-muted-foreground">Salud general del portafolio filtrado.</p>
          </CardHeader>
          <CardContent>
            <MetricList
              items={data.tenantLifecycleRows}
              emptyLabel="No hay tenants para el filtro actual."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top tenants por captación</CardTitle>
            <p className="text-sm text-muted-foreground">
              Empresas con más leads creados dentro del periodo.
            </p>
          </CardHeader>
          <CardContent>
            <MetricList
              items={data.topTenantsByLeads}
              emptyLabel="No hay leads registrados para este rango."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operación global</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tareas abiertas y volumen cotizado consolidado.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tareas
              </p>
              <MetricList items={data.taskStatusRows} emptyLabel="Sin tareas en alcance." />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cotizaciones
              </p>
              {data.quoteStatusRows.every((row) => row.value === 0) ? (
                <p className="text-sm text-muted-foreground">Sin cotizaciones en este rango.</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lectura rápida</CardTitle>
          <p className="text-sm text-muted-foreground">
            Resumen ejecutivo del alcance activo para compartir decisiones rápido.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Leads del periodo
            </p>
            <p className="mt-2 text-2xl font-bold">
              {data.summary.leadsInRange.toLocaleString('es-PE')}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Interacciones del periodo
            </p>
            <p className="mt-2 text-2xl font-bold">
              {data.summary.interactionsInRange.toLocaleString('es-PE')}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tareas abiertas
            </p>
            <p className="mt-2 text-2xl font-bold">
              {data.summary.openTasks.toLocaleString('es-PE')}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Volumen cotizado
            </p>
            <p className="mt-2 text-2xl font-bold">
              {data.summary.quoteVolume.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
