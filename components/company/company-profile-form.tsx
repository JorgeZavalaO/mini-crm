'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateCompanyProfileAction } from '@/lib/company-actions';
import type { CompanyProfile } from '@/lib/company-actions';

// Curated list of IANA timezones — Americas first, then rest
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'America/Lima', label: 'Lima, Bogotá, Quito (UTC-5)' },
  { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
  { value: 'America/Guayaquil', label: 'Guayaquil (UTC-5)' },
  { value: 'America/Santiago', label: 'Santiago (UTC-4/-3)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
  { value: 'America/Caracas', label: 'Caracas (UTC-4)' },
  { value: 'America/La_Paz', label: 'La Paz (UTC-4)' },
  { value: 'America/Asuncion', label: 'Asunción (UTC-4/-3)' },
  { value: 'America/Montevideo', label: 'Montevideo (UTC-3)' },
  { value: 'America/Guyana', label: 'Georgetown (UTC-4)' },
  { value: 'America/Paramaribo', label: 'Paramaribo (UTC-3)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (UTC-6/-5)' },
  { value: 'America/Monterrey', label: 'Monterrey (UTC-6/-5)' },
  { value: 'America/Tijuana', label: 'Tijuana (UTC-8/-7)' },
  { value: 'America/New_York', label: 'Nueva York (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Denver', label: 'Denver (UTC-7/-6)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (UTC-8/-7)' },
  { value: 'America/Toronto', label: 'Toronto (UTC-5/-4)' },
  { value: 'America/Vancouver', label: 'Vancouver (UTC-8/-7)' },
  { value: 'Europe/Madrid', label: 'Madrid (UTC+1/+2)' },
  { value: 'Europe/London', label: 'Londres (UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'París (UTC+1/+2)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

interface CompanyProfileFormProps {
  tenantSlug: string;
  initialData: CompanyProfile;
}

export function CompanyProfileForm({ tenantSlug, initialData }: CompanyProfileFormProps) {
  const [companyName, setCompanyName] = useState(initialData.companyName ?? '');
  const [companyRuc, setCompanyRuc] = useState(initialData.companyRuc ?? '');
  const [companyAddress, setCompanyAddress] = useState(initialData.companyAddress ?? '');
  const [companyPhone, setCompanyPhone] = useState(initialData.companyPhone ?? '');
  const [companyEmail, setCompanyEmail] = useState(initialData.companyEmail ?? '');
  const [companyWebsite, setCompanyWebsite] = useState(initialData.companyWebsite ?? '');
  const [companyTimezone, setCompanyTimezone] = useState(
    initialData.companyTimezone ?? 'America/Lima',
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateCompanyProfileAction({
          tenantSlug,
          companyName: companyName || undefined,
          companyRuc: companyRuc || undefined,
          companyAddress: companyAddress || undefined,
          companyPhone: companyPhone || undefined,
          companyEmail: companyEmail || undefined,
          companyWebsite: companyWebsite || undefined,
          companyTimezone,
        });
        toast.success('Perfil de empresa guardado');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar el perfil');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos fiscales */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Datos fiscales</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Razón social</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Empresa S.A.C."
              maxLength={200}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyRuc">RUC / NIF / RFC</Label>
            <Input
              id="companyRuc"
              value={companyRuc}
              onChange={(e) => setCompanyRuc(e.target.value)}
              placeholder="20123456789"
              maxLength={20}
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Contacto */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Contacto</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyPhone">Teléfono</Label>
            <Input
              id="companyPhone"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              placeholder="+51 1 234 5678"
              maxLength={50}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyEmail">Email corporativo</Label>
            <Input
              id="companyEmail"
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="contacto@empresa.com"
              maxLength={200}
              disabled={isPending}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyWebsite">Sitio web</Label>
          <Input
            id="companyWebsite"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
            placeholder="https://www.empresa.com"
            maxLength={200}
            disabled={isPending}
          />
        </div>
      </div>

      <Separator />

      {/* Domicilio */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Domicilio</h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyAddress">Dirección</Label>
          <Textarea
            id="companyAddress"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            placeholder="Av. Principal 123, Lima, Perú"
            maxLength={400}
            rows={2}
            disabled={isPending}
          />
        </div>
      </div>

      <Separator />

      {/* Configuración regional */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Configuración regional</h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyTimezone">Zona horaria</Label>
          <Select value={companyTimezone} onValueChange={setCompanyTimezone} disabled={isPending}>
            <SelectTrigger id="companyTimezone" className="w-full sm:max-w-xs">
              <SelectValue placeholder="Selecciona una zona horaria" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Todas las fechas y horas del sistema se mostrarán en esta zona horaria.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
