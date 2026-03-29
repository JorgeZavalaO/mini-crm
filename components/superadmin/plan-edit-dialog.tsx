'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { PlanEditForm } from '@/components/superadmin/plan-edit-card';
import type { SuperadminPlanRow } from '@/components/superadmin/plan-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function PlanEditDialog({ plan }: { plan: SuperadminPlanRow }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={`Editar plan ${plan.name}`}
          aria-label={`Editar plan ${plan.name}`}
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
          <DialogDescription>
            Ajusta limites, descripcion y funcionalidades del plan {plan.name}.
          </DialogDescription>
        </DialogHeader>
        <PlanEditForm plan={plan} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
