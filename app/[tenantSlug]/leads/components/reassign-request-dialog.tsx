'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { requestLeadReassignmentAction } from '@/lib/lead-actions';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type LeadOwnerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

interface ReassignRequestDialogProps {
  tenantSlug: string;
  leadId: string;
  owners: LeadOwnerOption[];
  trigger?: React.ReactNode;
}

const NO_SUGGESTION = '__NO_SUGGESTION__';

export function ReassignRequestDialog({
  tenantSlug,
  leadId,
  owners,
  trigger,
}: ReassignRequestDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [requestedOwnerId, setRequestedOwnerId] = useState<string>(NO_SUGGESTION);
  const [reason, setReason] = useState('');

  function onSubmit() {
    startTransition(async () => {
      try {
        await requestLeadReassignmentAction({
          tenantSlug,
          leadId,
          requestedOwnerId: requestedOwnerId === NO_SUGGESTION ? undefined : requestedOwnerId,
          reason,
        });
        toast.success('Solicitud de reasignacion creada');
        setOpen(false);
        setReason('');
        setRequestedOwnerId(NO_SUGGESTION);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo crear la solicitud';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            Solicitar reasignacion
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitud de reasignacion</DialogTitle>
          <DialogDescription>
            Describe por que este lead deberia cambiar de owner. Un supervisor/admin debe aprobar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Owner sugerido (opcional)</Label>
            <Select value={requestedOwnerId} onValueChange={setRequestedOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin sugerencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUGGESTION}>Sin sugerencia</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name || owner.email} ({owner.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`reason-${leadId}`}>Motivo</Label>
            <Textarea
              id={`reason-${leadId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ejemplo: ya existe relacion comercial previa con este cliente..."
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={isPending || reason.trim().length < 5}>
            {isPending ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
