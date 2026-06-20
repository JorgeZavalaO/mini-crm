import {
  Building2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Users as UsersIcon,
} from 'lucide-react';
import { ReportStatCard } from '@/components/reports/report-stat-card';
import { CompanyInteractionsTable } from '@/components/reports/company-interactions-table';
import { InteractionFilters } from '@/components/reports/interaction-filters';
import { CategoryBarChart } from '@/components/reports/category-bar-chart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { firstSearchParam } from '@/lib/pagination';
import { getCompanyInteractionsReport } from '@/lib/reporting/company-interactions-report';
import { INTERACTION_LABEL } from '@/lib/reporting/company-interactions-types';
import { normalizeReportDateRange, interactionReportFiltersSchema } from '@/lib/validators';
import { compactNumber, formatDateInput } from '@/lib/reporting/shared';

export default async function CompanyInteractionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;

  const parsedFilters = interactionReportFiltersSchema.safeParse({
    tenantSlug,
    preset: firstSearchParam(rawSearchParams.preset) ?? '30d',
    from: firstSearchParam(rawSearchParams.from),
    to: firstSearchParam(rawSearchParams.to),
    scope: firstSearchParam(rawSearchParams.scope) ?? 'all',
    type: firstSearchParam(rawSearchParams.type),
    authorId: firstSearchParam(rawSearchParams.authorId),
    leadStatus: firstSearchParam(rawSearchParams.leadStatus),
    leadOwnerId: firstSearchParam(rawSearchParams.leadOwnerId),
    city: firstSearchParam(rawSearchParams.city),
    country: firstSearchParam(rawSearchParams.country),
    industry: firstSearchParam(rawSearchParams.industry),
    q: firstSearchParam(rawSearchParams.q),
    page: firstSearchParam(rawSearchParams.page) ?? '1',
    pageSize: firstSearchParam(rawSearchParams.pageSize) ?? '20',
  });

  const filters = parsedFilters.success
    ? normalizeReportDateRange(parsedFilters.data)
    : normalizeReportDateRange(
        interactionReportFiltersSchema.parse({
          tenantSlug,
          preset: '30d',
          scope: 'all',
        }),
      );

  const data = await getCompanyInteractionsReport(filters);

  const channelChartData = data.interactionByType.map((row) => ({
    label: row.label,
    value: row.value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Interacciones</h1>
            <Badge variant="secondary">{data.range.label}</Badge>
            <Badge variant="outline">
              {data.actor.appliedScope === 'mine' ? 'Mi vista' : 'Todo el tenant'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Empresas contactadas por tu equipo con filtros por canal, autor y periodo.
          </p>
        </div>
      </div>

      <InteractionFilters
        key={
          data.filters.preset +
          '|' +
          (data.filters.from ? formatDateInput(data.filters.from) : '') +
          '|' +
          (data.filters.to ? formatDateInput(data.filters.to) : '') +
          '|' +
          data.filters.scope +
          '|' +
          (data.filters.type ?? '') +
          '|' +
          (data.filters.authorId ?? '') +
          '|' +
          (data.filters.leadStatus ?? '') +
          '|' +
          (data.filters.leadOwnerId ?? '') +
          '|' +
          (data.filters.city ?? '') +
          '|' +
          (data.filters.country ?? '') +
          '|' +
          (data.filters.industry ?? '') +
          '|' +
          (data.filters.q ?? '') +
          '|' +
          data.filters.pageSize
        }
        canViewAll={data.actor.canViewAll}
        filters={{
          preset: data.filters.preset,
          from: data.filters.from ? formatDateInput(data.filters.from) : undefined,
          to: data.filters.to ? formatDateInput(data.filters.to) : undefined,
          scope: data.filters.scope,
          type: data.filters.type,
          authorId: data.filters.authorId,
          leadStatus: data.filters.leadStatus,
          leadOwnerId: data.filters.leadOwnerId,
          city: data.filters.city,
          country: data.filters.country,
          industry: data.filters.industry,
          q: data.filters.q,
          page: data.filters.page,
          pageSize: data.filters.pageSize,
        }}
        options={data.filterOptions}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportStatCard
          title="Empresas contactadas"
          value={compactNumber(data.summary.companiesContacted)}
          description="Cantidad unica de empresas con al menos una interaccion."
          icon={Building2}
          tone="info"
          scopeLabel="Periodo"
        />
        <ReportStatCard
          title="Interacciones totales"
          value={compactNumber(data.summary.totalInteractions)}
          description="Suma de llamadas, correos, notas, visitas y WhatsApp."
          icon={MessageSquare}
          tone="accent"
          scopeLabel="Periodo"
        />
        <ReportStatCard
          title="Sin contactar"
          value={compactNumber(data.summary.companiesUncontacted)}
          description="Empresas del segmento sin interacciones en el rango."
          icon={UsersIcon}
          tone="warning"
          scopeLabel="Periodo"
        />
        <ReportStatCard
          title="Cobertura"
          value={
            data.summary.companiesContacted + data.summary.companiesUncontacted === 0
              ? '—'
              : `${Math.round(
                  (data.summary.companiesContacted /
                    Math.max(
                      1,
                      data.summary.companiesContacted + data.summary.companiesUncontacted,
                    )) *
                    100,
                )}%`
          }
          description="Porcentaje del segmento con al menos un contacto."
          icon={Phone}
          tone="success"
          scopeLabel="Periodo"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interacciones por canal</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribución de los contactos registrados en el periodo.
            </p>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={channelChartData}
              seriesLabel="Interacciones"
              color="hsl(var(--chart-3))"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top vendedores contactando</CardTitle>
            <p className="text-sm text-muted-foreground">
              Responsables con más interacciones registradas en el rango.
            </p>
          </CardHeader>
          <CardContent>
            {data.topAuthors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos para el periodo.</p>
            ) : (
              <ul className="space-y-3">
                {data.topAuthors.map((author, index) => {
                  const max = Math.max(...data.topAuthors.map((a) => a.value), 1);
                  return (
                    <li key={author.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-foreground">
                          <span className="mr-2 text-xs text-muted-foreground">#{index + 1}</span>
                          {author.name}
                        </span>
                        <span className="font-semibold tabular-nums">{author.value}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(author.value / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Empresas contactadas</h2>
            <p className="text-xs text-muted-foreground">
              Listado de {compactNumber(data.totalRows)} empresas con al menos un contacto en el
              periodo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3.5" /> Llamadas
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" /> WhatsApp
            </span>
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3.5" /> Correos
            </span>
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="size-3.5" /> Visitas
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" /> Notas
            </span>
            <span className="hidden md:inline">
              · Tipos: {Object.values(INTERACTION_LABEL).join(', ')}
            </span>
          </div>
        </div>

        <CompanyInteractionsTable
          rows={data.rows}
          tenantSlug={tenantSlug}
          timezone={data.tenant.timezone}
          queryState={{
            preset: data.filters.preset,
            scope: data.actor.appliedScope,
            type: data.filters.type,
            authorId: data.filters.authorId,
            leadStatus: data.filters.leadStatus,
            leadOwnerId: data.filters.leadOwnerId,
            city: data.filters.city,
            country: data.filters.country,
            industry: data.filters.industry,
            q: data.filters.q,
            pageSize: data.filters.pageSize,
          }}
          pagination={{
            currentPage: data.pagination.currentPage,
            totalPages: data.pagination.totalPages,
            totalItems: data.totalRows,
            startItem: data.pagination.startItem,
            endItem: data.pagination.endItem,
          }}
        />
      </div>
    </div>
  );
}
