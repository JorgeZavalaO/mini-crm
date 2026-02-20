'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTenantAction } from '@/lib/superadmin-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

type PlanOption = {
  id: string;
  name: string;
  maxUsers: number;
  maxStorageGb: number;
  retentionDays: number;
  isActive: boolean;
};

interface TenantCreateFormProps {
  plans: PlanOption[];
  onSuccess?: () => void;
  submitLabel?: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function TenantCreateForm({
  plans,
  onSuccess,
  submitLabel = 'Crear empresa',
}: TenantCreateFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createTenantAction, undefined);
  const [slug, setSlug] = useState('');
  const activePlans = useMemo(() => plans.filter((p) => p.isActive), [plans]);
  const [planId, setPlanId] = useState(activePlans[0]?.id ?? '');

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.refresh();
      onSuccess?.();
    }
  }, [state?.success, router, onSuccess]);

  if (activePlans.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No hay planes activos disponibles para crear tenants.</AlertDescription>
      </Alert>
    );
  }

  const selectedPlan = activePlans.find((p) => p.id === planId);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="companyName">Nombre de la empresa</Label>
        <Input
          id="companyName"
          name="companyName"
          placeholder="Acme Logistics"
          required
          onChange={(e) => setSlug(slugify(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug (URL)</Label>
        <Input
          id="slug"
          name="slug"
          placeholder="acme-logistics"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">URL: /{slug || 'slug'}/dashboard</p>
      </div>

      <div className="space-y-2">
        <Label>Plan</Label>
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un plan" />
          </SelectTrigger>
          <SelectContent>
            {activePlans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="planId" value={planId} />
        {selectedPlan ? (
          <p className="text-xs text-muted-foreground">
            Limites: {selectedPlan.maxUsers} usuarios, {selectedPlan.maxStorageGb} GB,{' '}
            {selectedPlan.retentionDays} dias de retencion
          </p>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="adminName">Nombre del administrador inicial</Label>
        <Input id="adminName" name="adminName" placeholder="Juan Perez" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="adminEmail">Email del administrador</Label>
        <Input
          id="adminEmail"
          name="adminEmail"
          type="email"
          placeholder="admin@acme.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="adminPassword">Contrasena</Label>
        <Input
          id="adminPassword"
          name="adminPassword"
          type="password"
          placeholder="Minimo 6 caracteres"
          required
          minLength={6}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creando...' : submitLabel}
      </Button>
    </form>
  );
}
