'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateQuoteAction } from '@/lib/quote-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ProductSelector, type ProductOption } from '@/components/quotes/product-selector';

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

type InitialData = {
  quoteId: string;
  quoteNumber: string;
  leadId: string;
  currency: 'PEN' | 'USD';
  taxRate: number;
  validUntil: Date | null;
  notes: string | null;
  items: { description: string; quantity: number; unitPrice: number }[];
};

type Props = {
  tenantSlug: string;
  leads: LeadOption[];
  products?: ProductOption[];
  initialData: InitialData;
  onSuccess?: () => void;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function taxRateToValue(rate: number): string {
  if (rate === 0) return '0';
  if (Math.abs(rate - 0.18) < 0.001) return '0.18';
  if (Math.abs(rate - 0.1) < 0.001) return '0.10';
  return String(rate);
}

function formatMoney(value: number, currency: 'PEN' | 'USD') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function QuoteEditForm({ tenantSlug, leads, products, initialData, onSuccess }: Props) {
  const [leadId, setLeadId] = useState(initialData.leadId);
  const [currency, setCurrency] = useState<'PEN' | 'USD'>(initialData.currency);
  const [taxRate, setTaxRate] = useState(taxRateToValue(initialData.taxRate));
  const [validUntil, setValidUntil] = useState(
    initialData.validUntil ? new Date(initialData.validUntil).toISOString().split('T')[0] : '',
  );
  const [notes, setNotes] = useState(initialData.notes ?? '');
  const [items, setItems] = useState<ItemDraft[]>(
    initialData.items.length > 0
      ? initialData.items.map((item) => ({
          id: uid(),
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        }))
      : [{ id: uid(), description: '', quantity: '1', unitPrice: '0' }],
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { subtotal, taxAmount, total } = useMemo(() => {
    const sub = items.reduce((sum, item) => {
      const q = Math.max(0, Number(item.quantity || 0));
      const p = Math.max(0, Number(item.unitPrice || 0));
      return sum + q * p;
    }, 0);
    const tax = Number(taxRate || 0);
    return { subtotal: sub, taxAmount: sub * tax, total: sub + sub * tax };
  }, [items, taxRate]);

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  }

  function addItem() {
    setItems((prev) => [...prev, { id: uid(), description: '', quantity: '1', unitPrice: '0' }]);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await updateQuoteAction({
          tenantSlug,
          quoteId: initialData.quoteId,
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
        toast.success('Cotización actualizada');
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo actualizar la cotización';
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Lead + Moneda + Impuesto */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="edit-lead">
            Cliente / Lead <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="edit-lead"
            options={leads.map((lead) => ({
              value: lead.id,
              label: lead.businessName,
              hint: lead.ruc ?? undefined,
            }))}
            value={leadId}
            onValueChange={setLeadId}
            placeholder="Seleccionar lead…"
            searchPlaceholder="Buscar por nombre o RUC…"
            emptyText="Sin leads encontrados."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-currency">Moneda</Label>
          <Select value={currency} onValueChange={(value) => setCurrency(value as 'PEN' | 'USD')}>
            <SelectTrigger id="edit-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PEN">PEN – Sol</SelectItem>
              <SelectItem value="USD">USD – Dólar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-tax">Impuesto</Label>
          <Select value={taxRate} onValueChange={setTaxRate}>
            <SelectTrigger id="edit-tax">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sin imp. (0%)</SelectItem>
              <SelectItem value="0.18">IGV 18%</SelectItem>
              <SelectItem value="0.10">10%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Ítems */}
      <div className="space-y-2">
        <div className="hidden grid-cols-12 gap-2 sm:grid">
          <p className="col-span-6 text-xs font-medium text-muted-foreground">Descripción</p>
          <p className="col-span-2 text-xs font-medium text-muted-foreground">Cantidad</p>
          <p className="col-span-3 text-xs font-medium text-muted-foreground">Precio unit.</p>
          <p className="col-span-1" />
        </div>

        {items.map((item, index) => (
          <div key={item.id} className="grid items-center gap-2 sm:grid-cols-12">
            <Input
              className="sm:col-span-6"
              placeholder={`Ítem ${index + 1} — descripción`}
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Cant."
              value={item.quantity}
              onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
            />
            <Input
              className="sm:col-span-3"
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
              className="sm:col-span-1 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(item.id)}
              disabled={items.length === 1}
              aria-label="Eliminar ítem"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1.5 size-3.5" />
            Agregar ítem
          </Button>
          {products && products.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Del catálogo:</span>
              <ProductSelector
                products={products}
                onSelect={(p) =>
                  setItems((prev) => [
                    ...prev,
                    {
                      id: uid(),
                      description: p.description ?? p.name,
                      quantity: '1',
                      unitPrice: String(p.unitPrice),
                    },
                  ])
                }
              />
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Preview totales */}
      <div className="flex justify-end">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatMoney(subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Impuesto ({(Number(taxRate) * 100).toFixed(0)}%)
            </dt>
            <dd>{formatMoney(taxAmount, currency)}</dd>
          </div>
          <Separator className="my-1" />
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd className="text-primary">{formatMoney(total, currency)}</dd>
          </div>
        </dl>
      </div>

      <Separator />

      {/* Validez + Notas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="edit-valid">Válida hasta</Label>
          <Input
            id="edit-valid"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-notes">Notas</Label>
          <Textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condiciones comerciales, alcance, observaciones…"
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" onClick={handleSubmit} disabled={isPending} className="min-w-36">
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Guardando…
            </>
          ) : (
            'Guardar cambios'
          )}
        </Button>
      </div>
    </div>
  );
}
