'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updatePlanAction } from '@/lib/superadmin-actions';
import { PlanFormFields } from '@/components/superadmin/plan-form-fields';
import type { SuperadminPlanRow } from '@/components/superadmin/plan-types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type PlanEditFormProps = {
  plan: SuperadminPlanRow;
  onSuccess?: () => void;
};

export function PlanEditForm({ plan, onSuccess }: PlanEditFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePlanAction, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onSuccess?.();
      router.refresh();
    }
  }, [onSuccess, router, state?.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="planId" value={plan.id} />
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <PlanFormFields
        idPrefix={`edit-plan-${plan.id}`}
        values={{
          name: plan.name,
          description: plan.description ?? '',
          maxUsers: plan.maxUsers,
          maxStorageGb: plan.maxStorageGb,
          retentionDays: plan.retentionDays,
          enabledFeatures: plan.features
            .filter((feature) => feature.enabled)
            .map((feature) => feature.featureKey),
        }}
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

export { PlanEditForm as PlanEditCard };
