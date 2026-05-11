import Link from 'next/link';
import { FilterX, SlidersHorizontal } from 'lucide-react';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from '@/lib/lead-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type TenantReportFiltersProps = {
  mode: 'tenant';
  basePath: string;
  canViewAll: boolean;
  filters: {
    preset: string;
    from?: string;
    to?: string;
    scope: 'mine' | 'all';
    ownerId?: string;
    status?: string;
    source?: string;
    country?: string;
    city?: string;
  };
  options: {
    owners: Array<{ id: string; label: string }>;
    sources: string[];
    countries: string[];
    cities: string[];
  };
};

type SuperadminReportFiltersProps = {
  mode: 'superadmin';
  basePath: string;
  filters: {
    preset: string;
    from?: string;
    to?: string;
    tenantState: 'all' | 'active' | 'inactive' | 'deleted';
    planId?: string;
    featureKey?: string;
  };
  options: {
    plans: Array<{ id: string; label: string }>;
    features: Array<{ value: string; label: string }>;
  };
};

type ReportFiltersProps = TenantReportFiltersProps | SuperadminReportFiltersProps;

const presetOptions = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'month', label: 'Mes actual' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año actual' },
  { value: 'custom', label: 'Personalizado' },
];

const selectClassName = cn(
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

export function ReportFilters(props: ReportFiltersProps) {
  return (
    <form method="get" action={props.basePath} className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Filtros del reporte</p>
          <p className="text-xs text-muted-foreground">
            Ajusta periodo y segmentación antes de revisar indicadores o exportar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Aplicar filtros
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={props.basePath}>
              <FilterX className="mr-2 h-4 w-4" />
              Limpiar
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="preset">Periodo</Label>
          <select
            id="preset"
            name="preset"
            defaultValue={props.filters.preset}
            className={selectClassName}
          >
            {presetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" name="from" type="date" defaultValue={props.filters.from} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" name="to" type="date" defaultValue={props.filters.to} />
        </div>

        {props.mode === 'tenant' ? (
          <div className="space-y-1.5">
            <Label htmlFor="scope">Alcance</Label>
            <select
              id="scope"
              name="scope"
              defaultValue={props.filters.scope}
              className={selectClassName}
              disabled={!props.canViewAll}
            >
              <option value="mine">Mi vista</option>
              <option value="all">Todo el tenant</option>
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="tenantState">Estado tenant</Label>
            <select
              id="tenantState"
              name="tenantState"
              defaultValue={props.filters.tenantState}
              className={selectClassName}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="deleted">Dados de baja</option>
            </select>
          </div>
        )}

        {props.mode === 'tenant' && props.canViewAll && props.options.owners.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="ownerId">Responsable</Label>
            <select
              id="ownerId"
              name="ownerId"
              defaultValue={props.filters.ownerId}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {props.options.owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {props.mode === 'tenant' && (
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado lead</Label>
            <select
              id="status"
              name="status"
              defaultValue={props.filters.status}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {LEAD_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
        )}

        {props.mode === 'tenant' && props.options.sources.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="source">Fuente</Label>
            <select
              id="source"
              name="source"
              defaultValue={props.filters.source}
              className={selectClassName}
            >
              <option value="">Todas</option>
              {props.options.sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        )}

        {props.mode === 'tenant' && props.options.countries.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="country">País</Label>
            <select
              id="country"
              name="country"
              defaultValue={props.filters.country}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {props.options.countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
        )}

        {props.mode === 'tenant' && props.options.cities.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="city">Ciudad</Label>
            <select
              id="city"
              name="city"
              defaultValue={props.filters.city}
              className={selectClassName}
            >
              <option value="">Todas</option>
              {props.options.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        )}

        {props.mode === 'superadmin' && props.options.plans.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="planId">Plan</Label>
            <select
              id="planId"
              name="planId"
              defaultValue={props.filters.planId}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {props.options.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {props.mode === 'superadmin' && props.options.features.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="featureKey">Módulo</Label>
            <select
              id="featureKey"
              name="featureKey"
              defaultValue={props.filters.featureKey}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {props.options.features.map((feature) => (
                <option key={feature.value} value={feature.value}>
                  {feature.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </form>
  );
}
