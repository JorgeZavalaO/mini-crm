'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeatureKey } from '@prisma/client';
import { toast } from 'sonner';
import { FEATURE_DESCRIPTION, FEATURE_KEYS, FEATURE_LABEL } from '@/lib/feature-catalog';
import {
  setTenantFeatureAction,
  updateTenantBasicsAction,
  updateTenantPlanAndLimitsAction,
} from '@/lib/superadmin-actions';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface TenantSettingsTabsProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
    planId: string | null;
    maxUsers: number | null;
    maxStorageGb: number | null;
    retentionDays: number | null;
  };
  plans: Array<{
    id: string;
    name: string;
    maxUsers: number;
    maxStorageGb: number;
    retentionDays: number;
    isActive: boolean;
  }>;
  features: Array<{ featureKey: FeatureKey; enabled: boolean; config: unknown }>;
}

export function TenantSettingsTabs({ tenant, plans, features }: TenantSettingsTabsProps) {
  const router = useRouter();
  const [basicState, basicAction, basicPending] = useActionState(
    updateTenantBasicsAction,
    undefined,
  );
  const [limitsState, limitsAction, limitsPending] = useActionState(
    updateTenantPlanAndLimitsAction,
    undefined,
  );

  useEffect(() => {
    if (basicState?.success) {
      toast.success(basicState.success);
      router.refresh();
    }
  }, [basicState?.success, router]);

  useEffect(() => {
    if (limitsState?.success) {
      toast.success(limitsState.success);
      router.refresh();
    }
  }, [limitsState?.success, router]);

  const initialFeatureMap = useMemo(() => {
    const map = new Map(features.map((f) => [f.featureKey, f]));
    return FEATURE_KEYS.map((featureKey) => ({
      featureKey,
      enabled: map.get(featureKey)?.enabled ?? false,
      configText:
        map.get(featureKey)?.config && map.get(featureKey)?.config !== null
          ? JSON.stringify(map.get(featureKey)?.config, null, 2)
          : '',
    }));
  }, [features]);

  const [featureRows, setFeatureRows] = useState(initialFeatureMap);
  const [featureSaving, setFeatureSaving] = useState<string | null>(null);
  const [planId, setPlanId] = useState(tenant.planId ?? plans[0]?.id ?? '');

  async function saveFeature(index: number, enabled: boolean, configText: string) {
    const row = featureRows[index];
    if (!row) return;

    setFeatureSaving(row.featureKey);
    try {
      await setTenantFeatureAction(tenant.id, row.featureKey, enabled, configText);
      setFeatureRows((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, enabled, configText } : item)),
      );
      toast.success(`Modulo ${FEATURE_LABEL[row.featureKey]} actualizado`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el modulo';
      toast.error(message);
    } finally {
      setFeatureSaving(null);
    }
  }

  return (
    <Tabs defaultValue="resumen" className="space-y-4">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="limites">Limites y plan</TabsTrigger>
        <TabsTrigger value="modulos">Modulos</TabsTrigger>
      </TabsList>

      <TabsContent value="resumen" className="space-y-4">
        <form action={basicAction} className="space-y-4 rounded-lg border p-4">
          <input type="hidden" name="tenantId" value={tenant.id} />
          {basicState?.error && (
            <Alert variant="destructive">
              <AlertDescription>{basicState.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre empresa</Label>
              <Input id="name" name="name" defaultValue={tenant.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" defaultValue={tenant.slug} required />
            </div>
          </div>
          <Button type="submit" disabled={basicPending}>
            {basicPending ? 'Guardando...' : 'Guardar datos basicos'}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="limites" className="space-y-4">
        <form action={limitsAction} className="space-y-4 rounded-lg border p-4">
          <input type="hidden" name="tenantId" value={tenant.id} />
          {limitsState?.error && (
            <Alert variant="destructive">
              <AlertDescription>{limitsState.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} {plan.isActive ? '' : '(inactivo)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="planId" value={planId} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="maxUsers">Max usuarios</Label>
              <Input
                id="maxUsers"
                name="maxUsers"
                type="number"
                min={1}
                defaultValue={tenant.maxUsers ?? 10}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxStorageGb">Storage (GB)</Label>
              <Input
                id="maxStorageGb"
                name="maxStorageGb"
                type="number"
                min={1}
                defaultValue={tenant.maxStorageGb ?? 5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retentionDays">Retencion (dias)</Label>
              <Input
                id="retentionDays"
                name="retentionDays"
                type="number"
                min={1}
                defaultValue={tenant.retentionDays ?? 180}
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="applyFeatureBundle" value="true" />
            Aplicar bundle de features del plan seleccionado
          </label>

          <Button type="submit" disabled={limitsPending}>
            {limitsPending ? 'Guardando...' : 'Guardar plan y limites'}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="modulos" className="space-y-3">
        {featureRows.map((row, idx) => (
          <div key={row.featureKey} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{FEATURE_LABEL[row.featureKey]}</p>
                <p className="text-sm text-muted-foreground">
                  {FEATURE_DESCRIPTION[row.featureKey]}
                </p>
              </div>
              <Switch
                checked={row.enabled}
                onCheckedChange={(checked) => saveFeature(idx, checked, row.configText)}
                disabled={featureSaving === row.featureKey}
              />
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor={`cfg-${row.featureKey}`}>Config JSON (opcional)</Label>
              <Textarea
                id={`cfg-${row.featureKey}`}
                value={row.configText}
                onChange={(e) =>
                  setFeatureRows((prev) =>
                    prev.map((item, itemIdx) =>
                      itemIdx === idx ? { ...item, configText: e.target.value } : item,
                    ),
                  )
                }
                className="min-h-[120px] font-mono text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={featureSaving === row.featureKey}
                onClick={() => saveFeature(idx, row.enabled, row.configText)}
              >
                {featureSaving === row.featureKey ? 'Guardando...' : 'Guardar config'}
              </Button>
            </div>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
