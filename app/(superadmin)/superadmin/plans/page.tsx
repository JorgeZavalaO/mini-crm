import Link from 'next/link';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { PlanCreateForm } from '@/components/superadmin/plan-create-form';
import { PlanEditCard } from '@/components/superadmin/plan-edit-card';

export default async function PlansPage() {
  const plans = await db.plan.findMany({
    orderBy: { name: 'asc' },
    include: {
      features: {
        select: { featureKey: true, enabled: true },
      },
    },
  });

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
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay planes creados.</p>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <PlanEditCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
