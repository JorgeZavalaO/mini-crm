import Link from 'next/link';
import { Building2, CalendarDays, HardDrive, Package, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { FEATURE_LABEL } from '@/lib/feature-catalog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreatePlanDialog } from '@/components/superadmin/create-plan-dialog';
import { PlanDetailsDialog } from '@/components/superadmin/plan-details-dialog';
import { PlanEditDialog } from '@/components/superadmin/plan-edit-dialog';
import { PlanToggleDialog } from '@/components/superadmin/plan-toggle-dialog';
import type { SuperadminPlanRow } from '@/components/superadmin/plan-types';

export default async function PlansPage() {
  const plans = await db.plan.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          tenants: {
            where: { deletedAt: null },
          },
        },
      },
      features: {
        select: { featureKey: true, enabled: true },
      },
    },
  });

  const planRows: SuperadminPlanRow[] = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    maxUsers: plan.maxUsers,
    maxStorageGb: plan.maxStorageGb,
    retentionDays: plan.retentionDays,
    isActive: plan.isActive,
    tenantsCount: plan._count.tenants,
    features: plan.features,
  }));

  const totalActive = planRows.filter((p) => p.isActive).length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Planes</h1>
            <Badge variant="secondary" className="text-xs">
              {totalActive} activos
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Define límites y bundle de módulos por plan comercial.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin">Volver al panel</Link>
          </Button>
          <CreatePlanDialog />
        </div>
      </div>

      {/* Cards */}
      {planRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aún no hay planes creados.</p>
          <CreatePlanDialog />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {planRows.map((plan) => {
            const enabledFeatures = plan.features.filter((f) => f.enabled);
            const previewFeatures = enabledFeatures.slice(0, 4);
            const remaining = enabledFeatures.length - previewFeatures.length;

            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-xl border bg-card transition-shadow hover:shadow-md ${
                  !plan.isActive ? 'opacity-60' : ''
                }`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 px-5 pt-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold">{plan.name}</h2>
                      <Badge
                        variant={plan.isActive ? 'default' : 'outline'}
                        className="shrink-0 text-xs"
                      >
                        {plan.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {plan.description?.trim() || 'Sin descripción comercial.'}
                    </p>
                  </div>
                </div>

                <Separator className="mt-4" />

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{plan.maxUsers}</span>
                    <span className="text-muted-foreground">usuarios</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{plan.maxStorageGb} GB</span>
                    <span className="text-muted-foreground">storage</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{plan.retentionDays}</span>
                    <span className="text-muted-foreground">días retención</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{plan.tenantsCount}</span>
                    <span className="text-muted-foreground">
                      {plan.tenantsCount === 1 ? 'tenant' : 'tenants'}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Features */}
                <div className="px-5 py-4 flex-1">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Módulos incluidos
                  </p>
                  {enabledFeatures.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin módulos configurados.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {previewFeatures.map((f) => (
                        <Badge key={f.featureKey} variant="secondary" className="text-xs">
                          {FEATURE_LABEL[f.featureKey]}
                        </Badge>
                      ))}
                      {remaining > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{remaining} más
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Acciones */}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {enabledFeatures.length} / {plan.features.length} módulos activos
                  </span>
                  <div className="flex items-center gap-0.5">
                    <PlanDetailsDialog plan={plan} />
                    <PlanEditDialog plan={plan} />
                    <PlanToggleDialog plan={plan} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
