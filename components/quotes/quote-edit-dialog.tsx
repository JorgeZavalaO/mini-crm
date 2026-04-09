'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { QuoteEditForm } from './quote-edit-form';
import { type ProductOption } from './product-selector';

type QuoteItemData = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type LeadOption = {
  id: string;
  businessName: string;
  ruc: string | null;
};

type InitialData = {
  quoteId: string;
  quoteNumber: string;
  leadId: string;
  currency: 'PEN' | 'USD';
  taxRate: number;
  validUntil: Date | null;
  notes: string | null;
  items: QuoteItemData[];
};

type Props = {
  tenantSlug: string;
  leads: LeadOption[];
  initialData: InitialData;
  products?: ProductOption[];
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
};

export function QuoteEditDialog({
  tenantSlug,
  leads,
  initialData,
  products,
  variant = 'outline',
  size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Pencil className="mr-2 size-4" />
          Editar cotización
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {initialData.quoteNumber}</DialogTitle>
          <DialogDescription>
            Modifica los datos de la cotización. Solo se pueden editar cotizaciones en borrador
            (SUPERVISOR+ puede editar enviadas).
          </DialogDescription>
        </DialogHeader>
        <QuoteEditForm
          tenantSlug={tenantSlug}
          leads={leads}
          products={products}
          initialData={initialData}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
