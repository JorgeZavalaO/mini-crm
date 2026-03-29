'use client';

import { Eye } from 'lucide-react';
import type { SuperadminPlanRow } from '@/components/superadmin/plan-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { FEATURE_LABEL } from '@/lib/feature-catalog';

export function PlanDetailsDialog({ plan }: { plan: SuperadminPlanRow }) {
  const enabledFeatures = plan.features.filter((feature) => feature.enabled);
  const disabledFeatures = plan.features.filter((feature) => !feature.enabled);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={`Ver detalles del plan ${plan.name}`}
          aria-label={`Ver detalles del plan ${plan.name}`}
        >
          <Eye />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{plan.name}</span>
            <Badge variant={plan.isActive ? 'default' : 'outline'}>
              {plan.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {plan.description?.trim() ||
              'Este plan aun no tiene una descripcion comercial definida.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Usuarios maximos</p>
              <p className="mt-1 text-2xl font-semibold">{plan.maxUsers}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Storage</p>
              <p className="mt-1 text-2xl font-semibold">{plan.maxStorageGb} GB</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Retencion</p>
              <p className="mt-1 text-2xl font-semibold">{plan.retentionDays} d</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Tenants asignados</p>
              <p className="mt-1 text-2xl font-semibold">{plan.tenantsCount}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="font-semibold">Features activas</h3>
                <p className="text-sm text-muted-foreground">
                  {enabledFeatures.length} funcionalidad(es) incluidas en este plan.
                </p>
              </div>
              {enabledFeatures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay features activas.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {enabledFeatures.map((feature) => (
                    <Badge key={feature.featureKey} variant="secondary">
                      {FEATURE_LABEL[feature.featureKey]}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <h3 className="font-semibold">Features desactivadas</h3>
                <p className="text-sm text-muted-foreground">
                  {disabledFeatures.length} funcionalidad(es) fuera del bundle actual.
                </p>
              </div>
              {disabledFeatures.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todas las features disponibles estan activas.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {disabledFeatures.map((feature) => (
                    <Badge key={feature.featureKey} variant="outline">
                      {FEATURE_LABEL[feature.featureKey]}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
