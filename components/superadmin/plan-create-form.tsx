'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { FeatureKey } from '@prisma/client';
import { FEATURE_DESCRIPTION, FEATURE_KEYS, FEATURE_LABEL } from '@/lib/feature-catalog';
import { createPlanAction } from '@/lib/superadmin-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function PlanCreateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createPlanAction, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      router.refresh();
    }
  }, [state?.success, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo plan</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" placeholder="Growth Plus" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUsers">Max usuarios</Label>
              <Input id="maxUsers" name="maxUsers" type="number" min={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxStorageGb">Storage (GB)</Label>
              <Input id="maxStorageGb" name="maxStorageGb" type="number" min={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retentionDays">Retencion (dias)</Label>
              <Input id="retentionDays" name="retentionDays" type="number" min={1} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripcion</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Plan para equipos en crecimiento..."
            />
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
            {pending ? 'Creando...' : 'Crear plan'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
