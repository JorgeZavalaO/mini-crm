'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { LeadStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min="0"
          step="1"
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder={minPlaceholder}
        />
        <Input
          type="number"
          min="0"
          step="1"
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder={maxPlaceholder}
        />
      </div>
    </div>
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
    startTransition(() => router.push(pathname));
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="q">Buscar</Label>
          <Input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Razon social, RUC, telefono, email..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyFilters();
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
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
        </div>

        <div className="space-y-2">
          <Label>Vendedor</Label>
          <SearchableSelect
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
            searchPlaceholder="Buscar vendedor…"
            emptyText="Sin vendedores encontrados."
          />
        </div>

        <div className="space-y-2">
          <Label>Fuente</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
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
        </div>

        <div className="space-y-2">
          <Label>Ciudad</Label>
          <SearchableSelect
            options={[
              { value: ALL, label: 'Todas' },
              ...cities.map((c) => ({ value: c, label: c })),
            ]}
            value={city}
            onValueChange={setCity}
            placeholder="Todas"
            searchPlaceholder="Buscar ciudad…"
            emptyText="Sin ciudades encontradas."
          />
        </div>
      </div>

      <div className="mt-4 space-y-4 rounded-lg border border-dashed p-4">
        <div>
          <h3 className="text-sm font-semibold">Ubicación y métricas</h3>
          <p className="text-xs text-muted-foreground">
            Usa filtros avanzados para segmentar por dirección expandida y capacidad operativa.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>País</Label>
            <SearchableSelect
              options={[
                { value: ALL, label: 'Todos' },
                ...countries.map((value) => ({ value, label: value })),
              ]}
              value={country}
              onValueChange={setCountry}
              placeholder="Todos"
              searchPlaceholder="Buscar país…"
              emptyText="Sin países encontrados."
            />
          </div>

          <div className="space-y-2">
            <Label>Provincia</Label>
            <SearchableSelect
              options={[
                { value: ALL, label: 'Todas' },
                ...provinces.map((value) => ({ value, label: value })),
              ]}
              value={province}
              onValueChange={setProvince}
              placeholder="Todas"
              searchPlaceholder="Buscar provincia…"
              emptyText="Sin provincias encontradas."
            />
          </div>

          <div className="space-y-2">
            <Label>Ciudad</Label>
            <SearchableSelect
              options={[
                { value: ALL, label: 'Todas' },
                ...cities.map((value) => ({ value, label: value })),
              ]}
              value={city}
              onValueChange={setCity}
              placeholder="Todas"
              searchPlaceholder="Buscar ciudad…"
              emptyText="Sin ciudades encontradas."
            />
          </div>

          <div className="space-y-2">
            <Label>Distrito</Label>
            <SearchableSelect
              options={[
                { value: ALL, label: 'Todos' },
                ...districts.map((value) => ({ value, label: value })),
              ]}
              value={district}
              onValueChange={setDistrict}
              placeholder="Todos"
              searchPlaceholder="Buscar distrito…"
              emptyText="Sin distritos encontrados."
            />
          </div>

          <NumberRangeFilter
            label="Año de constitución"
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
            minPlaceholder="Mínimo"
            maxPlaceholder="Máximo"
          />
          <NumberRangeFilter
            label="Cantidad de importación"
            minValue={importOperationCountMin}
            maxValue={importOperationCountMax}
            onMinChange={setImportOperationCountMin}
            onMaxChange={setImportOperationCountMax}
            minPlaceholder="Mínimo"
            maxPlaceholder="Máximo"
          />
          <NumberRangeFilter
            label="Cantidad de exportación"
            minValue={exportOperationCountMin}
            maxValue={exportOperationCountMax}
            onMinChange={setExportOperationCountMin}
            onMaxChange={setExportOperationCountMax}
            minPlaceholder="Mínimo"
            maxPlaceholder="Máximo"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={applyFilters} disabled={isPending}>
          {isPending ? 'Aplicando...' : 'Aplicar filtros'}
        </Button>
        <Button type="button" variant="outline" onClick={resetFilters} disabled={isPending}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
