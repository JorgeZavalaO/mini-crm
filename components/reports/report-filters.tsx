'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useTransition, useCallback, useMemo } from 'react';
import { FilterX, SlidersHorizontal } from 'lucide-react';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from '@/lib/lead-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type TenantFilterState = {
  preset: string;
  from: string;
  to: string;
  scope: 'mine' | 'all';
  ownerId: string;
  status: string;
  source: string;
  country: string;
  city: string;
};

type SuperadminFilterState = {
  preset: string;
  from: string;
  to: string;
  tenantState: 'all' | 'active' | 'inactive' | 'deleted';
  planId: string;
  featureKey: string;
};

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
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const isTenantMode = props.mode === 'tenant';

  const getInitialState = useCallback((): TenantFilterState | SuperadminFilterState => {
    if (isTenantMode) {
      const f = props.filters as TenantReportFiltersProps['filters'];
      return {
        preset: f.preset,
        from: f.from ?? '',
        to: f.to ?? '',
        scope: f.scope,
        ownerId: f.ownerId ?? '',
        status: f.status ?? '',
        source: f.source ?? '',
        country: f.country ?? '',
        city: f.city ?? '',
      };
    } else {
      const f = props.filters as SuperadminReportFiltersProps['filters'];
      return {
        preset: f.preset,
        from: f.from ?? '',
        to: f.to ?? '',
        tenantState: f.tenantState,
        planId: f.planId ?? '',
        featureKey: f.featureKey ?? '',
      };
    }
  }, [isTenantMode, props.filters]);

  const [state, setState] = useState(getInitialState);

  const isCustom = state.preset === 'custom';

  const applyFilters = useCallback(() => {
    startTransition(() => {
      const params = new URLSearchParams();

      params.set('preset', state.preset);

      if (isCustom) {
        if (state.from) params.set('from', state.from);
        if (state.to) params.set('to', state.to);
      }

      if (isTenantMode) {
        const s = state as TenantFilterState;
        if (s.scope) params.set('scope', s.scope);
        if (s.ownerId) params.set('ownerId', s.ownerId);
        if (s.status) params.set('status', s.status);
        if (s.source) params.set('source', s.source);
        if (s.country) params.set('country', s.country);
        if (s.city) params.set('city', s.city);
      } else {
        const s = state as SuperadminFilterState;
        if (s.tenantState) params.set('tenantState', s.tenantState);
        if (s.planId) params.set('planId', s.planId);
        if (s.featureKey) params.set('featureKey', s.featureKey);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }, [state, isCustom, isTenantMode, pathname, router]);

  const resetFilters = useCallback(() => {
    const defaultState = getInitialState();
    Object.keys(defaultState).forEach((key) => {
      if (key === 'preset') {
        (defaultState as Record<string, string>)[key] = 'custom';
      }
    });
    setState({
      ...defaultState,
      preset: 'custom',
      from: '',
      to: '',
      scope: isTenantMode ? 'all' : 'all',
      ownerId: '',
      status: '',
      source: '',
      country: '',
      city: '',
      tenantState: 'all',
      planId: '',
      featureKey: '',
    });
    startTransition(() => {
      router.push(props.basePath);
    });
  }, [getInitialState, isTenantMode, props.basePath, router]);

  const handlePresetChange = useCallback((value: string) => {
    setState((prev) => {
      const next = { ...prev, preset: value };
      if (value !== 'custom') {
        next.from = '';
        next.to = '';
      }
      return next;
    });
  }, []);

  const handleChange = useCallback((field: string, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const tenantOptions = useMemo(() => {
    if (!isTenantMode) return null;
    return props.options as TenantReportFiltersProps['options'];
  }, [isTenantMode, props.options]);

  const superadminOptions = useMemo(() => {
    if (isTenantMode) return null;
    return props.options as SuperadminReportFiltersProps['options'];
  }, [isTenantMode, props.options]);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Filtros del reporte</p>
          <p className="text-xs text-muted-foreground">
            Ajusta periodo y segmentación antes de revisar indicadores o exportar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={applyFilters} disabled={isPending}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {isPending ? 'Aplicando...' : 'Aplicar filtros'}
          </Button>
          <Button variant="outline" size="sm" onClick={resetFilters} disabled={isPending}>
            <FilterX className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="preset">Periodo</Label>
          <select
            id="preset"
            name="preset"
            value={state.preset}
            onChange={(e) => handlePresetChange(e.target.value)}
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
          <Input
            id="from"
            name="from"
            type="date"
            value={state.from}
            onChange={(e) => handleChange('from', e.target.value)}
            disabled={!isCustom}
            aria-describedby={!isCustom ? 'from-hint' : undefined}
          />
          {!isCustom && (
            <p id="from-hint" className="text-xs text-muted-foreground">
              Fijo según el periodo seleccionado
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">Hasta</Label>
          <Input
            id="to"
            name="to"
            type="date"
            value={state.to}
            onChange={(e) => handleChange('to', e.target.value)}
            disabled={!isCustom}
            aria-describedby={!isCustom ? 'to-hint' : undefined}
          />
          {!isCustom && (
            <p id="to-hint" className="text-xs text-muted-foreground">
              Fijo según el periodo seleccionado
            </p>
          )}
        </div>

        {isTenantMode ? (
          <div className="space-y-1.5">
            <Label htmlFor="scope">Alcance</Label>
            <select
              id="scope"
              name="scope"
              value={(state as TenantFilterState).scope}
              onChange={(e) => handleChange('scope', e.target.value)}
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
              value={(state as SuperadminFilterState).tenantState}
              onChange={(e) => handleChange('tenantState', e.target.value)}
              className={selectClassName}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="deleted">Dados de baja</option>
            </select>
          </div>
        )}

        {isTenantMode && tenantOptions && tenantOptions.owners.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="ownerId">Responsable</Label>
            <select
              id="ownerId"
              name="ownerId"
              value={(state as TenantFilterState).ownerId}
              onChange={(e) => handleChange('ownerId', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {tenantOptions.owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {isTenantMode && (
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado lead</Label>
            <select
              id="status"
              name="status"
              value={(state as TenantFilterState).status}
              onChange={(e) => handleChange('status', e.target.value)}
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

        {isTenantMode && tenantOptions && tenantOptions.sources.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="source">Fuente</Label>
            <select
              id="source"
              name="source"
              value={(state as TenantFilterState).source}
              onChange={(e) => handleChange('source', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todas</option>
              {tenantOptions.sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        )}

        {isTenantMode && tenantOptions && tenantOptions.countries.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="country">País</Label>
            <select
              id="country"
              name="country"
              value={(state as TenantFilterState).country}
              onChange={(e) => handleChange('country', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {tenantOptions.countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
        )}

        {isTenantMode && tenantOptions && tenantOptions.cities.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="city">Ciudad</Label>
            <select
              id="city"
              name="city"
              value={(state as TenantFilterState).city}
              onChange={(e) => handleChange('city', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todas</option>
              {tenantOptions.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isTenantMode && superadminOptions && superadminOptions.plans.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="planId">Plan</Label>
            <select
              id="planId"
              name="planId"
              value={(state as SuperadminFilterState).planId}
              onChange={(e) => handleChange('planId', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {superadminOptions.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isTenantMode && superadminOptions && superadminOptions.features.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="featureKey">Módulo</Label>
            <select
              id="featureKey"
              name="featureKey"
              value={(state as SuperadminFilterState).featureKey}
              onChange={(e) => handleChange('featureKey', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {superadminOptions.features.map((feature) => (
                <option key={feature.value} value={feature.value}>
                  {feature.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
