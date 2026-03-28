'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cancelTeamInvitationAction } from '@/lib/team-invite-actions';
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

export function CancelInviteButton({
  invitationId,
  tenantSlug,
  inviteEmail,
}: {
  invitationId: string;
  tenantSlug: string;
  inviteEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const result = await cancelTeamInvitationAction(invitationId, tenantSlug);
      toast.success(`La invitación para ${result.inviteEmail} fue cancelada`);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cancelar la invitación';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
          Cancelar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar invitación</DialogTitle>
          <DialogDescription>
            ¿Deseas cancelar la invitación pendiente para {inviteEmail}? El enlace dejará de ser
            válido.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Volver
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Cancelando…' : 'Confirmar cancelación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
