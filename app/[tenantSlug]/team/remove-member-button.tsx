'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { removeMemberAction } from '@/lib/team-actions';
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

export function RemoveMemberButton({
  membershipId,
  tenantSlug,
  memberName,
}: {
  membershipId: string;
  tenantSlug: string;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const result = await removeMemberAction(membershipId, tenantSlug);
      toast.success(`${result.userName} fue removido del equipo correctamente`);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo remover al miembro';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
          Remover
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover miembro</DialogTitle>
          <DialogDescription>
            ¿Seguro que deseas remover a {memberName} de este tenant? El usuario perderá el acceso a
            esta empresa, pero su cuenta global se conservará.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Removiendo…' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
