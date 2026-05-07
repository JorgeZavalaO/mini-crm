'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { LeadStatus } from '@prisma/client';
import { CheckCircle2, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

const ALL = '__ALL__';

type OwnerFilterOption = {
  id: string;
  name: string;
  email: string;
};

interface LeadFiltersProps {
  initial: {
    q?: string;
    status?: LeadStatus;
    ownerId?: string;
    country?: string;
    province?: string;
    source?: string;
    city?: string;
    district?: string;
    constitutionYearMin?: number;
    constitutionYearMax?: number;
    employeeCountMin?: number;
    employeeCountMax?: number;
    importOperationCountMin?: number;
    importOperationCountMax?: number;
    exportOperationCountMin?: number;
    exportOperationCountMax?: number;
  };
  owners: OwnerFilterOption[];
  countries: string[];
  provinces: string[];
  sources: string[];
  cities: string[];
  districts: string[];
}

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'QUALIFIED', label: 'Calificado' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'WON', label: 'Ganado' },
];

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `flex flex-col gap-1.5 ${className}` : 'flex flex-col gap-1.5'}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NumberRangeFilter({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minPlaceholder,
  maxPlaceholder,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  minPlaceholder: string;
  maxPlaceholder: string;
}) {
  return (
    <FilterField label={label}>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min="0"
          step="1"
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder={minPlaceholder}
          className="h-9"
        />
        <Input
          type="number"
          min="0"
          step="1"
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder={maxPlaceholder}
          className="h-9"
        />
      </div>
    </FilterField>
  );
}

export function LeadFilters({
  initial,
  owners,
  countries,
  provinces,
  sources,
  cities,
  districts,
}: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initial.q ?? '');
  const [status, setStatus] = useState<string>(initial.status ?? ALL);
  const [ownerId, setOwnerId] = useState<string>(initial.ownerId ?? ALL);
  const [country, setCountry] = useState<string>(initial.country ?? ALL);
  const [province, setProvince] = useState<string>(initial.province ?? ALL);
  const [source, setSource] = useState<string>(initial.source ?? ALL);
  const [city, setCity] = useState<string>(initial.city ?? ALL);
  const [district, setDistrict] = useState<string>(initial.district ?? ALL);
  const [constitutionYearMin, setConstitutionYearMin] = useState(
    initial.constitutionYearMin?.toString() ?? '',
  );
  const [constitutionYearMax, setConstitutionYearMax] = useState(
    initial.constitutionYearMax?.toString() ?? '',
  );
  const [employeeCountMin, setEmployeeCountMin] = useState(
    initial.employeeCountMin?.toString() ?? '',
  );
  const [employeeCountMax, setEmployeeCountMax] = useState(
    initial.employeeCountMax?.toString() ?? '',
  );
  const [importOperationCountMin, setImportOperationCountMin] = useState(
    initial.importOperationCountMin?.toString() ?? '',
  );
  const [importOperationCountMax, setImportOperationCountMax] = useState(
    initial.importOperationCountMax?.toString() ?? '',
  );
  const [exportOperationCountMin, setExportOperationCountMin] = useState(
    initial.exportOperationCountMin?.toString() ?? '',
  );
  const [exportOperationCountMax, setExportOperationCountMax] = useState(
    initial.exportOperationCountMax?.toString() ?? '',
  );
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(
      initial.country ||
      initial.province ||
      initial.district ||
      initial.constitutionYearMin !== undefined ||
      initial.constitutionYearMax !== undefined ||
      initial.employeeCountMin !== undefined ||
      initial.employeeCountMax !== undefined ||
      initial.importOperationCountMin !== undefined ||
      initial.importOperationCountMax !== undefined ||
      initial.exportOperationCountMin !== undefined ||
      initial.exportOperationCountMax !== undefined,
    ),
  );

  const activeFilters = useMemo(
    () =>
      [
        q.trim() ? 'Busqueda' : null,
        status !== ALL ? 'Estado' : null,
        ownerId !== ALL ? 'Vendedor' : null,
        source !== ALL ? 'Fuente' : null,
        city !== ALL ? 'Ciudad' : null,
        country !== ALL ? 'Pais' : null,
        province !== ALL ? 'Provincia' : null,
        district !== ALL ? 'Distrito' : null,
        constitutionYearMin.trim() || constitutionYearMax.trim() ? 'Constitucion' : null,
        employeeCountMin.trim() || employeeCountMax.trim() ? 'Trabajadores' : null,
        importOperationCountMin.trim() || importOperationCountMax.trim() ? 'Importacion' : null,
        exportOperationCountMin.trim() || exportOperationCountMax.trim() ? 'Exportacion' : null,
      ].filter((value): value is string => Boolean(value)),
    [
      q,
      status,
      ownerId,
      source,
      city,
      country,
      province,
      district,
      constitutionYearMin,
      constitutionYearMax,
      employeeCountMin,
      employeeCountMax,
      importOperationCountMin,
      importOperationCountMax,
      exportOperationCountMin,
      exportOperationCountMax,
    ],
  );
  const activeCount = activeFilters.length;

  function applyFilters() {
    startTransition(() => {
      const params = new URLSearchParams();

      if (q.trim()) params.set('q', q.trim());
      if (status !== ALL) params.set('status', status);
      if (ownerId !== ALL) params.set('ownerId', ownerId);
      if (country !== ALL) params.set('country', country);
      if (province !== ALL) params.set('province', province);
      if (source !== ALL) params.set('source', source);
      if (city !== ALL) params.set('city', city);
      if (district !== ALL) params.set('district', district);
      if (constitutionYearMin.trim()) params.set('constitutionYearMin', constitutionYearMin.trim());
      if (constitutionYearMax.trim()) params.set('constitutionYearMax', constitutionYearMax.trim());
      if (employeeCountMin.trim()) params.set('employeeCountMin', employeeCountMin.trim());
      if (employeeCountMax.trim()) params.set('employeeCountMax', employeeCountMax.trim());
      if (importOperationCountMin.trim()) {
        params.set('importOperationCountMin', importOperationCountMin.trim());
      }
      if (importOperationCountMax.trim()) {
        params.set('importOperationCountMax', importOperationCountMax.trim());
      }
      if (exportOperationCountMin.trim()) {
        params.set('exportOperationCountMin', exportOperationCountMin.trim());
      }
      if (exportOperationCountMax.trim()) {
        params.set('exportOperationCountMax', exportOperationCountMax.trim());
      }
      params.set('page', '1');

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function resetFilters() {
    setQ('');
    setStatus(ALL);
    setOwnerId(ALL);
    setCountry(ALL);
    setProvince(ALL);
    setSource(ALL);
    setCity(ALL);
    setDistrict(ALL);
    setConstitutionYearMin('');
    setConstitutionYearMax('');
    setEmployeeCountMin('');
    setEmployeeCountMax('');
    setImportOperationCountMin('');
    setImportOperationCountMax('');
    setExportOperationCountMin('');
    setExportOperationCountMax('');
    setAdvancedOpen(false);
    startTransition(() => router.push(pathname));
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Filtros de leads</h2>
              <p className="text-xs text-muted-foreground">
                Segmenta por pipeline, owner, origen, ubicacion y capacidad operativa.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {activeCount} activo{activeCount === 1 ? '' : 's'}
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="gap-1.5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {advancedOpen ? 'Ocultar avanzados' : 'Mostrar avanzados'}
            </Button>
          </div>
        </div>

        {activeCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.slice(0, 8).map((filter) => (
              <Badge key={filter} variant="outline" className="bg-background text-xs">
                {filter}
              </Badge>
            ))}
            {activeFilters.length > 8 && (
              <Badge variant="outline" className="bg-background text-xs">
                +{activeFilters.length - 8}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,2fr)_repeat(4,minmax(160px,1fr))]">
          <FilterField label="Buscar" className="md:col-span-2 xl:col-span-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Razon social, RUC, telefono, email..."
                className="h-9 pl-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyFilters();
                  }
                }}
              />
            </div>
          </FilterField>

          <FilterField label="Estado">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Vendedor">
            <SearchableSelect
              className="h-9"
              options={[
                { value: ALL, label: 'Todos' },
                { value: '__UNASSIGNED__', label: 'Sin vendedor asignado' },
                ...owners.map((owner) => ({
                  value: owner.id,
                  label: owner.name || owner.email,
                  hint: owner.name ? owner.email : undefined,
                })),
              ]}
              value={ownerId}
              onValueChange={setOwnerId}
              placeholder="Todos"
              searchPlaceholder="Buscar vendedor..."
              emptyText="Sin vendedores encontrados."
            />
          </FilterField>

          <FilterField label="Fuente">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {sources.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Ciudad">
            <SearchableSelect
              className="h-9"
              options={[
                { value: ALL, label: 'Todas' },
                ...cities.map((value) => ({ value, label: value })),
              ]}
              value={city}
              onValueChange={setCity}
              placeholder="Todas"
              searchPlaceholder="Buscar ciudad..."
              emptyText="Sin ciudades encontradas."
            />
          </FilterField>
        </div>

        {advancedOpen && (
          <div className="flex flex-col gap-4 rounded-lg border border-dashed bg-muted/20 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">Ubicacion y metricas</h3>
              <p className="text-xs text-muted-foreground">
                Usa estos filtros para segmentaciones finas sin cargar la vista principal.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Pais">
                <SearchableSelect
                  className="h-9"
                  options={[
                    { value: ALL, label: 'Todos' },
                    ...countries.map((value) => ({ value, label: value })),
                  ]}
                  value={country}
                  onValueChange={setCountry}
                  placeholder="Todos"
                  searchPlaceholder="Buscar pais..."
                  emptyText="Sin paises encontrados."
                />
              </FilterField>

              <FilterField label="Provincia">
                <SearchableSelect
                  className="h-9"
                  options={[
                    { value: ALL, label: 'Todas' },
                    ...provinces.map((value) => ({ value, label: value })),
                  ]}
                  value={province}
                  onValueChange={setProvince}
                  placeholder="Todas"
                  searchPlaceholder="Buscar provincia..."
                  emptyText="Sin provincias encontradas."
                />
              </FilterField>

              <FilterField label="Ciudad">
                <SearchableSelect
                  className="h-9"
                  options={[
                    { value: ALL, label: 'Todas' },
                    ...cities.map((value) => ({ value, label: value })),
                  ]}
                  value={city}
                  onValueChange={setCity}
                  placeholder="Todas"
                  searchPlaceholder="Buscar ciudad..."
                  emptyText="Sin ciudades encontradas."
                />
              </FilterField>

              <FilterField label="Distrito">
                <SearchableSelect
                  className="h-9"
                  options={[
                    { value: ALL, label: 'Todos' },
                    ...districts.map((value) => ({ value, label: value })),
                  ]}
                  value={district}
                  onValueChange={setDistrict}
                  placeholder="Todos"
                  searchPlaceholder="Buscar distrito..."
                  emptyText="Sin distritos encontrados."
                />
              </FilterField>

              <NumberRangeFilter
                label="Ano de constitucion"
                minValue={constitutionYearMin}
                maxValue={constitutionYearMax}
                onMinChange={setConstitutionYearMin}
                onMaxChange={setConstitutionYearMax}
                minPlaceholder="Desde"
                maxPlaceholder="Hasta"
              />
              <NumberRangeFilter
                label="Cantidad de trabajadores"
                minValue={employeeCountMin}
                maxValue={employeeCountMax}
                onMinChange={setEmployeeCountMin}
                onMaxChange={setEmployeeCountMax}
                minPlaceholder="Minimo"
                maxPlaceholder="Maximo"
              />
              <NumberRangeFilter
                label="Cantidad de importacion"
                minValue={importOperationCountMin}
                maxValue={importOperationCountMax}
                onMinChange={setImportOperationCountMin}
                onMaxChange={setImportOperationCountMax}
                minPlaceholder="Minimo"
                maxPlaceholder="Maximo"
              />
              <NumberRangeFilter
                label="Cantidad de exportacion"
                minValue={exportOperationCountMin}
                maxValue={exportOperationCountMax}
                onMinChange={setExportOperationCountMin}
                onMaxChange={setExportOperationCountMax}
                minPlaceholder="Minimo"
                maxPlaceholder="Maximo"
              />
            </div>
          </div>
        )}

        <Separator />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Enter aplica la busqueda. Los filtros avanzados permanecen activos aunque esten ocultos.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" onClick={applyFilters} disabled={isPending} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {isPending ? 'Aplicando...' : 'Aplicar filtros'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              disabled={isPending || activeCount === 0}
              className="gap-1.5"
            >
              <X className="h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
