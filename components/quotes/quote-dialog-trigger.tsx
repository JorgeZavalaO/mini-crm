'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { QuoteCreateForm } from './quote-create-form';

type LeadOption = {
  id: string;
  businessName: string;
  ruc: string | null;
};

type Props = {
  tenantSlug: string;
  leads: LeadOption[];
  defaultLeadId?: string;
};

export function QuoteDialogTrigger({ tenantSlug, leads, defaultLeadId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Nueva cotización
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva cotización</DialogTitle>
          <DialogDescription>
            Completa los datos para generar una propuesta comercial. Se registrará automáticamente
            en el historial del lead.
          </DialogDescription>
        </DialogHeader>
        <QuoteCreateForm
          tenantSlug={tenantSlug}
          leads={leads}
          defaultLeadId={defaultLeadId}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
