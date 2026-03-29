'use client';

import { useState } from 'react';
import { Power } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { togglePlanAction } from '@/lib/superadmin-actions';
import type { SuperadminPlanRow } from '@/components/superadmin/plan-types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function PlanToggleDialog({ plan }: { plan: SuperadminPlanRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onTogglePlan() {
    setPending(true);
    try {
      await togglePlanAction(plan.id);
      toast.success(`Plan ${plan.isActive ? 'desactivado' : 'activado'}`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo actualizar el estado del plan';
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={plan.isActive ? `Desactivar plan ${plan.name}` : `Activar plan ${plan.name}`}
          aria-label={plan.isActive ? `Desactivar plan ${plan.name}` : `Activar plan ${plan.name}`}
        >
          <Power />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{plan.isActive ? 'Desactivar plan' : 'Activar plan'}</AlertDialogTitle>
          <AlertDialogDescription>
            {plan.isActive
              ? `El plan ${plan.name} dejara de estar disponible para nuevas asignaciones. Los ${plan.tenantsCount} tenant(s) ya asociados conservaran su configuracion actual.`
              : `El plan ${plan.name} volvera a quedar disponible para ser asignado a nuevos tenants.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onTogglePlan} disabled={pending}>
            {pending ? 'Procesando...' : plan.isActive ? 'Desactivar' : 'Activar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
