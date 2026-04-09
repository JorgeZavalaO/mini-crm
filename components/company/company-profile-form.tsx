'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { updateCompanyProfileAction } from '@/lib/company-actions';
import type { CompanyProfile } from '@/lib/company-actions';

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

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
