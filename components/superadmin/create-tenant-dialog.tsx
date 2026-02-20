'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TenantCreateForm } from '@/components/superadmin/tenant-create-form';

type PlanOption = {
  id: string;
  name: string;
  maxUsers: number;
  maxStorageGb: number;
  retentionDays: number;
  isActive: boolean;
};

export function CreateTenantDialog({ plans }: { plans: PlanOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Nueva empresa</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva empresa</DialogTitle>
          <DialogDescription>
            Crea un tenant, asigna plan y configura administrador inicial.
          </DialogDescription>
        </DialogHeader>
        <TenantCreateForm plans={plans} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
