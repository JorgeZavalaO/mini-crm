import Link from 'next/link';
import type { FeatureKey } from '@prisma/client';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { PlanCreateForm } from '@/components/superadmin/plan-create-form';
import { PlanEditCard } from '@/components/superadmin/plan-edit-card';

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  maxUsers: number;
  maxStorageGb: number;
  retentionDays: number;
  isActive: boolean;
  features: Array<{ featureKey: FeatureKey; enabled: boolean }>;
};

export default async function PlansPage() {
  const plans = await db.plan.findMany({
    orderBy: { name: 'asc' },
    include: {
      features: {
        select: { featureKey: true, enabled: true },
      },
    },
  });

  const planRows = plans as PlanRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planes</h1>
          <p className="text-muted-foreground">Define limites y bundle de modulos por plan.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin">Volver al panel</Link>
        </Button>
      </div>

      <PlanCreateForm />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Catalogo de planes</h2>
        {planRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay planes creados.</p>
        ) : (
          <div className="grid gap-4">
            {planRows.map((plan: PlanRow) => (
              <PlanEditCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
