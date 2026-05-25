'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  bulkAssignLeadsAction,
  bulkAssignByFilterAction,
  countLeadsByFilterAction,
} from '@/lib/lead-actions';
import type { LeadFilters } from '@/lib/lead-query';
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

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  VENDEDOR: 'Vendedor',
  FREELANCE: 'Freelance',
  PASANTE: 'Pasante',
};

type BulkAssignDialogProps =
  | {
      mode: 'ids';
      tenantSlug: string;
      owners: LeadOwnerOption[];
      leadIds: string[];
      triggerLabel?: string;
    }
  | {
      mode: 'filter';
      tenantSlug: string;
      owners: LeadOwnerOption[];
      filters: Omit<LeadFilters, 'page' | 'pageSize'>;
      triggerLabel?: string;
    };

export function BulkAssignDialog(props: BulkAssignDialogProps) {
  const { mode, tenantSlug, owners, triggerLabel = 'Asignación masiva' } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [filterCount, setFilterCount] = useState<number | null>(null);
  const filters = mode === 'filter' ? props.filters : undefined;

  const idCount = mode === 'ids' ? props.leadIds.length : 0;
  const count = mode === 'ids' ? idCount : (filterCount ?? 0);
  const disabled = count === 0 || owners.length === 0;
  const isLoadingCount = mode === 'filter' && open && filterCount === null;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (mode === 'filter') {
      setFilterCount(null);
    }
  }

  function handleOwnerChange(value: string) {
    setOwnerId(value);
    if (mode === 'filter' && open) {
      setFilterCount(null);
    }
  }

  // When the dialog opens in filter mode, fetch the matching count
  useEffect(() => {
    if (!open || mode !== 'filter' || filterCount !== null) return;

    let cancelled = false;

    countLeadsByFilterAction({ tenantSlug, ownerId, filters: filters ?? {} })
      .then(({ count: c }) => {
        if (!cancelled) setFilterCount(c);
      })
      .catch(() => {
        if (!cancelled) setFilterCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [open, mode, tenantSlug, ownerId, filterCount, filters]);

  const ownerLabel = useMemo(() => owners.find((owner) => owner.id === ownerId), [owners, ownerId]);

  function onConfirm() {
    if (!ownerId || count === 0) return;

    startTransition(async () => {
      try {
        let updatedCount: number;

        if (mode === 'ids') {
          const result = await bulkAssignLeadsAction({
            tenantSlug,
            leadIds: props.leadIds,
            ownerId,
          });
          updatedCount = result.updatedCount;
        } else {
          const result = await bulkAssignByFilterAction({
            tenantSlug,
            ownerId,
            filters: props.filters,
          });
          updatedCount = result.updatedCount;
        }

        toast.success(
          `${updatedCount} lead(s) asignados a ${ownerLabel?.name || ownerLabel?.email}`,
        );
        setOpen(false);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo asignar los leads';
        toast.error(message);
      }
    });
  }

  function countLabel() {
    if (mode === 'ids') {
      return count === 0
        ? 'Selecciona al menos un lead para asignar.'
        : `Asignarás ${count} lead(s) a un responsable.`;
    }
    if (isLoadingCount) return 'Calculando leads a asignar…';
    return count === 0
      ? 'No hay leads que coincidan con los filtros actuales.'
      : `Asignarás ${count} lead(s) que coinciden con el filtro activo.`;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled && mode === 'ids'}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignación masiva</DialogTitle>
          <DialogDescription>{countLabel()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Responsable destino</Label>
          <Select value={ownerId} onValueChange={handleOwnerChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un responsable" />
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name || owner.email} ({ROLE_LABEL[owner.role] ?? owner.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending || disabled || !ownerId || isLoadingCount}
          >
            {isPending ? 'Asignando...' : 'Confirmar asignación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
