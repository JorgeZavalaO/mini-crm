'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createQuoteAction } from '@/lib/quote-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { type ProductOption } from '@/components/quotes/product-selector';

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
  taxExempt: boolean;
};

type Props = {
  tenantSlug: string;
  leads: LeadOption[];
  products?: ProductOption[];
  defaultLeadId?: string;
  onSuccess?: () => void;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const EMPTY_ITEM = (): ItemDraft => ({
  id: uid(),
  description: '',
  quantity: '1',
  unitPrice: '0',
  taxExempt: false,
});

function formatMoney(value: number, currency: 'PEN' | 'USD') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function ItemDescriptionCombobox({
  value,
  placeholder,
  products,
  onChange,
  onProductSelect,
  className,
}: {
  value: string;
  placeholder: string;
  products: ProductOption[];
  onChange: (v: string) => void;
  onProductSelect: (p: ProductOption) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (products.length === 0 || value.length > 60) return [];
    if (value.length === 0) return products;
    const lower = value.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.description?.toLowerCase().includes(lower) ?? false),
    );
  }, [products, value]);

  if (products.length === 0) {
    return (
      <Input
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          className={className}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            <CommandGroup>
              {filtered.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    onProductSelect(p);
                    setOpen(false);
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      {p.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.description}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Intl.NumberFormat('es-PE', {
                        style: 'currency',
                        currency: p.currency,
                        minimumFractionDigits: 2,
                      }).format(p.unitPrice)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function QuoteCreateForm({ tenantSlug, leads, products, defaultLeadId, onSuccess }: Props) {
  const [leadId, setLeadId] = useState(defaultLeadId ?? leads[0]?.id ?? '');
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [taxRate, setTaxRate] = useState('0.18');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([EMPTY_ITEM()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { subtotal, taxAmount, total } = useMemo(() => {
    const sub = items.reduce((sum, item) => {
      const q = Math.max(0, Number(item.quantity || 0));
      const p = Math.max(0, Number(item.unitPrice || 0));
      return sum + q * p;
    }, 0);
    const taxableSub = items.reduce((sum, item) => {
      if (item.taxExempt) return sum;
      const q = Math.max(0, Number(item.quantity || 0));
      const p = Math.max(0, Number(item.unitPrice || 0));
      return sum + q * p;
    }, 0);
    const tax = Number(taxRate || 0);
    return { subtotal: sub, taxAmount: taxableSub * tax, total: sub + taxableSub * tax };
  }, [items, taxRate]);

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  }

  function addItem() {
    setItems((prev) => [...prev, EMPTY_ITEM()]);
  }

  function resetForm() {
    setItems([EMPTY_ITEM()]);
    setNotes('');
    setValidUntil('');
    setTaxRate('0.18');
    setError(null);
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
            taxExempt: item.taxExempt,
          })),
        });
        toast.success('Cotización creada');
        resetForm();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo crear la cotización';
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

      {/* Fila 1: Lead + Moneda + Impuesto */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="quote-lead">
            Cliente / Lead <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="quote-lead"
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
          <Label htmlFor="quote-currency">Moneda</Label>
          <Select value={currency} onValueChange={(value) => setCurrency(value as 'PEN' | 'USD')}>
            <SelectTrigger id="quote-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PEN">PEN – Sol</SelectItem>
              <SelectItem value="USD">USD – Dólar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quote-tax">Impuesto</Label>
          <Select value={taxRate} onValueChange={setTaxRate}>
            <SelectTrigger id="quote-tax">
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
            <ItemDescriptionCombobox
              className="sm:col-span-6"
              placeholder={`Ítem ${index + 1} — descripción o busca en catálogo`}
              value={item.description}
              products={products ?? []}
              onChange={(v) => updateItem(item.id, { description: v })}
              onProductSelect={(p) =>
                updateItem(item.id, {
                  description: p.description ? `${p.name} - ${p.description}` : p.name,
                  unitPrice: String(p.unitPrice),
                  taxExempt: p.taxExempt,
                })
              }
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
            {item.taxExempt && (
              <div className="sm:col-start-1 sm:col-span-6 flex items-center">
                <Badge variant="outline" className="text-xs h-5">
                  Sin IGV
                </Badge>
              </div>
            )}
          </div>
        ))}

        <div className="mt-1">
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1.5 size-3.5" />
            Agregar ítem
          </Button>
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
          <Label htmlFor="quote-valid">Válida hasta</Label>
          <Input
            id="quote-valid"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-notes">Notas</Label>
          <Textarea
            id="quote-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condiciones comerciales, alcance, observaciones…"
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
          Limpiar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || leads.length === 0}
          className="min-w-32"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creando…
            </>
          ) : (
            'Crear cotización'
          )}
        </Button>
      </div>
    </div>
  );
}
