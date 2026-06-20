'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { FilterX, Search, SlidersHorizontal } from 'lucide-react';
import type { LeadStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  INTERACTION_LABEL,
  INTERACTION_TYPE_ORDER,
  computePresetRange,
} from '@/lib/reporting/company-interactions-types';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from '@/lib/lead-status';

type FiltersState = {
  preset: string;
  from: string;
  to: string;
  scope: 'mine' | 'all';
  type: string;
  authorId: string;
  leadStatus: string;
  leadOwnerId: string;
  city: string;
  country: string;
  industry: string;
  q: string;
  page: number;
  pageSize: number;
};

type Props = {
  basePath?: string;
  canViewAll: boolean;
  filters: {
    preset: string;
    from?: string;
    to?: string;
    scope: 'mine' | 'all';
    type?: string;
    authorId?: string;
    leadStatus?: string;
    leadOwnerId?: string;
    city?: string;
    country?: string;
    industry?: string;
    q?: string;
    page: number;
    pageSize: number;
  };
  options: {
    authors: Array<{ id: string; name: string }>;
    cities: string[];
    countries: string[];
    industries: string[];
  };
};

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

function buildQueryString(state: FiltersState): string {
  const params = new URLSearchParams();
  params.set('preset', state.preset);
  if (state.preset === 'custom') {
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
  }
  params.set('scope', state.scope);
  if (state.type) params.set('type', state.type);
  if (state.authorId) params.set('authorId', state.authorId);
  if (state.leadStatus) params.set('leadStatus', state.leadStatus);
  if (state.leadOwnerId) params.set('leadOwnerId', state.leadOwnerId);
  if (state.city) params.set('city', state.city);
  if (state.country) params.set('country', state.country);
  if (state.industry) params.set('industry', state.industry);
  if (state.q) params.set('q', state.q);
  params.set('pageSize', String(state.pageSize));
  return params.toString();
}

function pushQuery(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  qs: string,
  startTransition: (cb: () => void) => void,
) {
  startTransition(() => {
    router.push(qs ? `${pathname}?${qs}` : pathname);
  });
}

export function InteractionFilters({ canViewAll, filters, options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const initialPreset = filters.preset || 'custom';
  const presetRange = useMemo(() => computePresetRange(initialPreset), [initialPreset]);
  const initialFrom = filters.from ?? (initialPreset !== 'custom' ? presetRange.from : '');
  const initialTo = filters.to ?? (initialPreset !== 'custom' ? presetRange.to : '');

  const [state, setState] = useState<FiltersState>(() => ({
    preset: initialPreset,
    from: initialFrom,
    to: initialTo,
    scope: filters.scope,
    type: filters.type ?? '',
    authorId: filters.authorId ?? '',
    leadStatus: filters.leadStatus ?? '',
    leadOwnerId: filters.leadOwnerId ?? '',
    city: filters.city ?? '',
    country: filters.country ?? '',
    industry: filters.industry ?? '',
    q: filters.q ?? '',
    page: filters.page,
    pageSize: filters.pageSize,
  }));

  const navigate = useCallback(
    (next: FiltersState) => {
      pushQuery(router, pathname, buildQueryString(next), startTransition);
    },
    [pathname, router],
  );

  const applyFilters = useCallback(
    (next: Partial<FiltersState>) => {
      const merged: FiltersState = { ...state, ...next, page: 1 };
      setState(merged);
      navigate(merged);
    },
    [navigate, state],
  );

  const handleField = useCallback(
    (field: keyof FiltersState, value: string | number) => {
      applyFilters({ [field]: value } as Partial<FiltersState>);
    },
    [applyFilters],
  );

  const handlePresetChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        const next: FiltersState = { ...state, preset: 'custom', page: 1 };
        setState(next);
        navigate(next);
        return;
      }
      const range = computePresetRange(value);
      const next: FiltersState = {
        ...state,
        preset: value,
        from: range.from,
        to: range.to,
        page: 1,
      };
      setState(next);
      navigate(next);
    },
    [navigate, state],
  );

  const handleManualDateChange = useCallback(
    (field: 'from' | 'to', value: string) => {
      const currentPreset = state.preset;
      const isPresetActive = currentPreset !== 'custom';
      if (isPresetActive) {
        const range = computePresetRange(currentPreset);
        if (range.from === value || range.to === value) {
          setState((prev) => ({ ...prev, [field]: value }));
          return;
        }
      }
      const next: FiltersState = {
        ...state,
        preset: 'custom',
        [field]: value,
        page: 1,
      };
      setState(next);
      navigate(next);
    },
    [navigate, state],
  );

  const handleDateBlur = useCallback(
    (field: 'from' | 'to') => {
      if (state.preset === 'custom') {
        const next: FiltersState = { ...state, [field]: state[field], page: 1 };
        navigate(next);
      }
    },
    [navigate, state],
  );

  const resetFilters = useCallback(() => {
    const next: FiltersState = {
      preset: 'custom',
      from: '',
      to: '',
      scope: 'all',
      type: '',
      authorId: '',
      leadStatus: '',
      leadOwnerId: '',
      city: '',
      country: '',
      industry: '',
      q: '',
      page: 1,
      pageSize: filters.pageSize,
    };
    setState(next);
    pushQuery(router, pathname, buildQueryString(next), startTransition);
  }, [filters.pageSize, pathname, router]);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Filtros de interacciones</p>
          <p className="text-xs text-muted-foreground">
            Ajusta periodo, canal, autor y empresa para localizar contactos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetFilters} disabled={isPending}>
            <FilterX className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5 xl:col-span-2">
          <Label htmlFor="q">Buscar empresa</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="q"
              name="q"
              value={state.q}
              onChange={(e) => setState((prev) => ({ ...prev, q: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleField('q', state.q);
                }
              }}
              placeholder="Razón social o RUC"
              className="pl-8"
            />
          </div>
        </div>

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
          <Label htmlFor="type">Canal</Label>
          <select
            id="type"
            name="type"
            value={state.type}
            onChange={(e) => handleField('type', e.target.value)}
            className={selectClassName}
          >
            <option value="">Todos</option>
            {INTERACTION_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {INTERACTION_LABEL[type]}
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
            max={state.to || undefined}
            onChange={(e) => handleManualDateChange('from', e.target.value)}
            onBlur={() => handleDateBlur('from')}
          />
          {state.preset !== 'custom' && (
            <p className="text-xs text-muted-foreground">
              Calculado por el periodo, editable para fijar el rango
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
            min={state.from || undefined}
            onChange={(e) => handleManualDateChange('to', e.target.value)}
            onBlur={() => handleDateBlur('to')}
          />
          {state.preset !== 'custom' && (
            <p className="text-xs text-muted-foreground">
              Calculado por el periodo, editable para fijar el rango
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scope">Alcance</Label>
          <select
            id="scope"
            name="scope"
            value={state.scope}
            onChange={(e) => handleField('scope', e.target.value)}
            className={selectClassName}
            disabled={!canViewAll}
          >
            <option value="mine">Mi vista</option>
            <option value="all">Todo el tenant</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="authorId">Autor del contacto</Label>
          <select
            id="authorId"
            name="authorId"
            value={state.authorId}
            onChange={(e) => handleField('authorId', e.target.value)}
            className={selectClassName}
          >
            <option value="">Todos</option>
            {options.authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="leadStatus">Estado del lead</Label>
          <select
            id="leadStatus"
            name="leadStatus"
            value={state.leadStatus}
            onChange={(e) => handleField('leadStatus', e.target.value)}
            className={selectClassName}
          >
            <option value="">Todos</option>
            {LEAD_STATUS_ORDER.map((status: LeadStatus) => (
              <option key={status} value={status}>
                {LEAD_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leadOwnerId">Responsable del lead</Label>
          <select
            id="leadOwnerId"
            name="leadOwnerId"
            value={state.leadOwnerId}
            onChange={(e) => handleField('leadOwnerId', e.target.value)}
            className={selectClassName}
          >
            <option value="">Todos</option>
            {options.authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
        </div>

        {options.countries.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="country">País</Label>
            <select
              id="country"
              name="country"
              value={state.country}
              onChange={(e) => handleField('country', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todos</option>
              {options.countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
        )}
        {options.cities.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="city">Ciudad</Label>
            <select
              id="city"
              name="city"
              value={state.city}
              onChange={(e) => handleField('city', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todas</option>
              {options.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        )}
        {options.industries.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industria</Label>
            <select
              id="industry"
              name="industry"
              value={state.industry}
              onChange={(e) => handleField('industry', e.target.value)}
              className={selectClassName}
            >
              <option value="">Todas</option>
              {options.industries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isPending && (
        <p className="text-xs text-muted-foreground">
          <SlidersHorizontal className="mr-1 inline-block h-3 w-3" />
          Aplicando filtros...
        </p>
      )}
    </div>
  );
}
