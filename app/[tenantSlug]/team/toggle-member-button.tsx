'use client';

import { useState } from 'react';
import { toggleMemberAction } from '@/lib/team-actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export function ToggleMemberButton({
  membershipId,
  isActive,
  tenantSlug,
}: {
  membershipId: string;
  isActive: boolean;
  tenantSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const result = await toggleMemberAction(membershipId, tenantSlug);
      toast.success(
        `${result.userName} fue ${result.isActive ? 'activado' : 'desactivado'} correctamente`,
      );
      setOpen(false);
    } catch {
      toast.error('No se pudo realizar la acción');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            isActive
              ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
              : 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
          }
        >
          {isActive ? 'Desactivar' : 'Activar'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isActive ? 'Desactivar miembro' : 'Activar miembro'}</DialogTitle>
          <DialogDescription>
            {isActive
              ? '¿Estás seguro? Este miembro perderá acceso al CRM de esta empresa.'
              : '¿Estás seguro? Se restaurará el acceso de este miembro.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={isActive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando…' : isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
