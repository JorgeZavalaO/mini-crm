'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createQuoteAction } from '@/lib/quote-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type LeadOption = {
  id: string;
  businessName: string;
  ruc: string | null;
};

type ItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type Props = {
  tenantSlug: string;
  leads: LeadOption[];
  defaultLeadId?: string;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function QuoteCreateForm({ tenantSlug, leads, defaultLeadId }: Props) {
  const [leadId, setLeadId] = useState(defaultLeadId ?? leads[0]?.id ?? '');
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [taxRate, setTaxRate] = useState('0.18');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([
    { id: uid(), description: '', quantity: '1', unitPrice: '0' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subtotalPreview = useMemo(() => {
    return items.reduce((sum, item) => {
      const q = Number(item.quantity || 0);
      const p = Number(item.unitPrice || 0);
      return sum + q * p;
    }, 0);
  }, [items]);

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  }

  function addItem() {
    setItems((prev) => [...prev, { id: uid(), description: '', quantity: '1', unitPrice: '0' }]);
  }

  function resetForm() {
    setTaxRate('0.18');
    setValidUntil('');
    setNotes('');
    setItems([{ id: uid(), description: '', quantity: '1', unitPrice: '0' }]);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await createQuoteAction({
          tenantSlug,
          leadId,
          currency,
          taxRate: Number(taxRate),
          validUntil: validUntil || undefined,
          notes,
          items: items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        });
        toast.success('Cotización creada');
        resetForm();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo crear la cotización';
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Lead</p>
          <Select value={leadId} onValueChange={setLeadId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar lead" />
            </SelectTrigger>
            <SelectContent>
              {leads.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.businessName} {lead.ruc ? `(${lead.ruc})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Moneda</p>
          <Select value={currency} onValueChange={(value) => setCurrency(value as 'PEN' | 'USD')}>
            <SelectTrigger>
              <SelectValue placeholder="Moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PEN">PEN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Impuesto</p>
          <Input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0.18" />
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        {items.map((item, index) => (
          <div key={item.id} className="grid gap-2 md:grid-cols-12">
            <Input
              className="md:col-span-6"
              placeholder={`Descripción del item ${index + 1}`}
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
            />
            <Input
              className="md:col-span-2"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Cant."
              value={item.quantity}
              onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
            />
            <Input
              className="md:col-span-3"
              type="number"
              min="0"
              step="0.01"
              placeholder="Precio"
              value={item.unitPrice}
              onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:col-span-1"
              onClick={() => removeItem(item.id)}
              disabled={items.length === 1}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 size-3.5" />
            Agregar item
          </Button>
          <p className="text-sm text-muted-foreground">
            Subtotal estimado: <span className="font-medium">{subtotalPreview.toFixed(2)}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Válida hasta</p>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condiciones comerciales, alcance, observaciones"
          />
        </div>
      </div>

      <Button type="button" onClick={handleSubmit} disabled={isPending || leads.length === 0}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Creando...
          </>
        ) : (
          'Crear cotización'
        )}
      </Button>
    </div>
  );
}
