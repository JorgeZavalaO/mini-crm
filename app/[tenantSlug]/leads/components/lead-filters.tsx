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
    source?: string;
    city?: string;
  };
  owners: OwnerFilterOption[];
  sources: string[];
  cities: string[];
}

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'QUALIFIED', label: 'Calificado' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'WON', label: 'Ganado' },
];

export function LeadFilters({ initial, owners, sources, cities }: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initial.q ?? '');
  const [status, setStatus] = useState<string>(initial.status ?? ALL);
  const [ownerId, setOwnerId] = useState<string>(initial.ownerId ?? ALL);
  const [source, setSource] = useState<string>(initial.source ?? ALL);
  const [city, setCity] = useState<string>(initial.city ?? ALL);

  function applyFilters() {
    startTransition(() => {
      const params = new URLSearchParams();

      if (q.trim()) params.set('q', q.trim());
      if (status !== ALL) params.set('status', status);
      if (ownerId !== ALL) params.set('ownerId', ownerId);
      if (source !== ALL) params.set('source', source);
      if (city !== ALL) params.set('city', city);
      params.set('page', '1');

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function resetFilters() {
    setQ('');
    setStatus(ALL);
    setOwnerId(ALL);
    setSource(ALL);
    setCity(ALL);
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
          <Label>Owner</Label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name || owner.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {cities.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
