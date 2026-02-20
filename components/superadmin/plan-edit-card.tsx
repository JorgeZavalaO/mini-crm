'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { FeatureKey } from '@prisma/client';
import { FEATURE_DESCRIPTION, FEATURE_KEYS, FEATURE_LABEL } from '@/lib/feature-catalog';
import { togglePlanAction, updatePlanAction } from '@/lib/superadmin-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PlanEditCardProps {
  plan: {
    id: string;
    name: string;
    description: string | null;
    maxUsers: number;
    maxStorageGb: number;
    retentionDays: number;
    isActive: boolean;
    features: Array<{ featureKey: FeatureKey; enabled: boolean }>;
  };
}

export function PlanEditCard({ plan }: PlanEditCardProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePlanAction, undefined);
  const [toggling, setToggling] = useState(false);
  const enabledSet = useMemo(
    () => new Set(plan.features.filter((f) => f.enabled).map((f) => f.featureKey)),
    [plan.features],
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.refresh();
    }
  }, [state?.success, router]);

  async function onTogglePlan() {
    setToggling(true);
    try {
      await togglePlanAction(plan.id);
      toast.success(`Plan ${plan.isActive ? 'inactivado' : 'activado'}`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo actualizar el estado del plan';
      toast.error(message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{plan.name}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={plan.isActive ? 'default' : 'outline'}>
            {plan.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
          <Button variant="outline" size="sm" onClick={onTogglePlan} disabled={toggling}>
            {toggling ? 'Procesando...' : plan.isActive ? 'Inactivar' : 'Activar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="planId" value={plan.id} />
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input name="name" defaultValue={plan.name} required />
            </div>
            <div className="space-y-2">
              <Label>Max usuarios</Label>
              <Input name="maxUsers" type="number" min={1} defaultValue={plan.maxUsers} required />
            </div>
            <div className="space-y-2">
              <Label>Storage (GB)</Label>
              <Input
                name="maxStorageGb"
                type="number"
                min={1}
                defaultValue={plan.maxStorageGb}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Retencion (dias)</Label>
              <Input
                name="retentionDays"
                type="number"
                min={1}
                defaultValue={plan.retentionDays}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripcion</Label>
            <Textarea name="description" defaultValue={plan.description ?? ''} />
          </div>

          <div className="space-y-2">
            <Label>Features incluidas</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_KEYS.map((featureKey: FeatureKey) => (
                <label
                  key={featureKey}
                  className="flex items-start gap-2 rounded-md border p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="enabledFeatures"
                    value={featureKey}
                    defaultChecked={enabledSet.has(featureKey)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">{FEATURE_LABEL[featureKey]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {FEATURE_DESCRIPTION[featureKey]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
