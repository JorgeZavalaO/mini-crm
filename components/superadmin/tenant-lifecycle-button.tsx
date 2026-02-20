'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { restoreTenantAction, softDeleteTenantAction } from '@/lib/superadmin-actions';

interface TenantLifecycleButtonProps {
  tenantId: string;
  isDeleted: boolean;
}

export function TenantLifecycleButton({ tenantId, isDeleted }: TenantLifecycleButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAction() {
    setLoading(true);
    try {
      if (isDeleted) {
        await restoreTenantAction(tenantId);
        toast.success('Tenant restaurado');
      } else {
        await softDeleteTenantAction(tenantId);
        toast.success('Tenant dado de baja');
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la accion';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={isDeleted ? 'secondary' : 'destructive'} size="sm" disabled={loading}>
          {isDeleted ? 'Restaurar' : 'Baja'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDeleted ? 'Restaurar tenant' : 'Dar de baja tenant'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDeleted
              ? 'El tenant volvera a estar disponible y podras activarlo cuando quieras.'
              : 'Se marcara como baja logica. Sus usuarios no podran ingresar.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleAction} disabled={loading}>
            {loading ? 'Procesando...' : isDeleted ? 'Restaurar' : 'Confirmar baja'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
