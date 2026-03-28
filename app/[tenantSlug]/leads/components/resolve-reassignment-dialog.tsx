'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { resolveLeadReassignmentAction } from '@/lib/lead-actions';
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

const NO_OWNER = '__NO_OWNER__';

export function ResolveReassignmentDialog({
  tenantSlug,
  requestId,
  status,
  owners,
  defaultOwnerId,
  trigger,
}: {
  tenantSlug: string;
  requestId: string;
  status: 'APPROVED' | 'REJECTED';
  owners: LeadOwnerOption[];
  defaultOwnerId?: string | null;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [ownerId, setOwnerId] = useState(defaultOwnerId ?? owners[0]?.id ?? NO_OWNER);
  const [resolutionNote, setResolutionNote] = useState('');

  const requiresOwner = status === 'APPROVED';
  const canSubmit = status === 'REJECTED' || ownerId !== NO_OWNER;

  function handleConfirm() {
    startTransition(async () => {
      try {
        await resolveLeadReassignmentAction({
          tenantSlug,
          requestId,
          status,
          ownerId: requiresOwner && ownerId !== NO_OWNER ? ownerId : undefined,
          resolutionNote: resolutionNote.trim() || undefined,
        });
        toast.success(`Solicitud ${status === 'APPROVED' ? 'aprobada' : 'rechazada'}`);
        setOpen(false);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo resolver la solicitud';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setOwnerId(defaultOwnerId ?? owners[0]?.id ?? NO_OWNER);
          setResolutionNote('');
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {status === 'APPROVED' ? 'Aprobar reasignación' : 'Rechazar reasignación'}
          </DialogTitle>
          <DialogDescription>
            {status === 'APPROVED'
              ? 'Confirma el owner final del lead y, si hace falta, agrega una nota de resolución.'
              : 'Rechaza la solicitud y agrega una nota opcional para dejar contexto al equipo.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {requiresOwner && (
            <div className="space-y-2">
              <Label>Owner final</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OWNER}>Selecciona un owner</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name || owner.email} ({owner.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`${requestId}-${status.toLowerCase()}-resolution-note`}>
              Nota de resolución (opcional)
            </Label>
            <Textarea
              id={`${requestId}-${status.toLowerCase()}-resolution-note`}
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="Ejemplo: se reasigna por cobertura comercial en otra ciudad"
              className="min-h-30"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant={status === 'APPROVED' ? 'secondary' : 'destructive'}
            onClick={handleConfirm}
            disabled={isPending || !canSubmit}
          >
            {isPending
              ? status === 'APPROVED'
                ? 'Aprobando...'
                : 'Rechazando...'
              : status === 'APPROVED'
                ? 'Confirmar aprobación'
                : 'Confirmar rechazo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
