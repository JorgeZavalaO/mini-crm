'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { bulkAssignLeadsAction } from '@/lib/lead-actions';
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

type LeadOwnerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

interface BulkAssignDialogProps {
  tenantSlug: string;
  owners: LeadOwnerOption[];
  leadIds: string[];
  triggerLabel?: string;
}

export function BulkAssignDialog({
  tenantSlug,
  owners,
  leadIds,
  triggerLabel = 'Asignacion masiva',
}: BulkAssignDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');

  const count = leadIds.length;
  const disabled = count === 0 || owners.length === 0;

  const ownerLabel = useMemo(() => owners.find((owner) => owner.id === ownerId), [owners, ownerId]);

  function onConfirm() {
    if (!ownerId || count === 0) return;

    startTransition(async () => {
      try {
        const result = await bulkAssignLeadsAction({
          tenantSlug,
          leadIds,
          ownerId,
        });
        toast.success(
          `${result.updatedCount} lead(s) asignados a ${ownerLabel?.name || ownerLabel?.email}`,
        );
        setOpen(false);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo asignar los leads';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignacion masiva</DialogTitle>
          <DialogDescription>
            {count === 0
              ? 'Selecciona al menos un lead para asignar.'
              : `Asignaras ${count} lead(s) a un owner.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Owner destino</Label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un owner" />
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name || owner.email} ({owner.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isPending || disabled || !ownerId}>
            {isPending ? 'Asignando...' : 'Confirmar asignacion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
