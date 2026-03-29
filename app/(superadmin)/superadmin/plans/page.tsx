import Link from 'next/link';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreatePlanDialog } from '@/components/superadmin/create-plan-dialog';
import { PlanDetailsDialog } from '@/components/superadmin/plan-details-dialog';
import { PlanEditDialog } from '@/components/superadmin/plan-edit-dialog';
import { PlanToggleDialog } from '@/components/superadmin/plan-toggle-dialog';
import type { SuperadminPlanRow } from '@/components/superadmin/plan-types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planes</h1>
          <p className="text-muted-foreground">Define limites y bundle de modulos por plan.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/superadmin">Volver al panel</Link>
          </Button>
          <CreatePlanDialog />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Catalogo de planes</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead>Limites</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Aun no hay planes creados.
                  </TableCell>
                </TableRow>
              ) : (
                planRows.map((plan) => {
                  const enabledFeatures = plan.features.filter((feature) => feature.enabled);
                  const previewFeatures = enabledFeatures.slice(0, 3);
                  const remainingFeatures = Math.max(
                    0,
                    enabledFeatures.length - previewFeatures.length,
                  );

                  return (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{plan.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ID: {plan.id.slice(0, 8)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        <span className="block truncate">
                          {plan.description?.trim() || 'Sin descripcion comercial.'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span>{plan.maxUsers} usuarios</span>
                          <span>{plan.maxStorageGb} GB</span>
                          <span>{plan.retentionDays} dias</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-1">
                            {previewFeatures.map((feature) => (
                              <Badge key={feature.featureKey} variant="secondary">
                                {feature.featureKey}
                              </Badge>
                            ))}
                            {remainingFeatures > 0 && (
                              <Badge variant="outline">+{remainingFeatures}</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {enabledFeatures.length} activas de {plan.features.length}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{plan.tenantsCount}</TableCell>
                      <TableCell>
                        <Badge variant={plan.isActive ? 'default' : 'outline'}>
                          {plan.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PlanDetailsDialog plan={plan} />
                          <PlanEditDialog plan={plan} />
                          <PlanToggleDialog plan={plan} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
