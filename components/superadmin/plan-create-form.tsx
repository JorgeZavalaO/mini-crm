'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createPlanAction } from '@/lib/superadmin-actions';
import { PlanFormFields } from '@/components/superadmin/plan-form-fields';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type PlanCreateFormProps = {
  onSuccess?: () => void;
};

export function PlanCreateForm({ onSuccess }: PlanCreateFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createPlanAction, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onSuccess?.();
      router.refresh();
    }
  }, [onSuccess, router, state?.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <PlanFormFields
        idPrefix="create-plan"
        values={{
          name: '',
          description: '',
          maxUsers: '',
          maxStorageGb: '',
          retentionDays: '',
          enabledFeatures: [],
        }}
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creando...' : 'Crear plan'}
        </Button>
      </div>
    </form>
  );
}
