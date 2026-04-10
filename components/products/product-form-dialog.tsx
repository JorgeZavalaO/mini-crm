'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createProductAction, updateProductAction, type ProductRow } from '@/lib/product-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface ProductFormDialogProps {
  tenantSlug: string;
  product?: ProductRow;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

export function ProductFormDialog({
  tenantSlug,
  product,
  trigger,
  onSuccess,
}: ProductFormDialogProps) {
  const isEdit = Boolean(product);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [unitPrice, setUnitPrice] = useState(product ? String(product.unitPrice) : '');
  const [currency, setCurrency] = useState<'PEN' | 'USD'>(product?.currency ?? 'PEN');
  const [taxExempt, setTaxExempt] = useState(product?.taxExempt ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    if (!isEdit) {
      setName('');
      setDescription('');
      setUnitPrice('');
      setCurrency('PEN');
      setTaxExempt(false);
    }
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit && product) {
          await updateProductAction({
            tenantSlug,
            productId: product.id,
            name,
            description: description || undefined,
            unitPrice: Number(unitPrice),
            currency,
            taxExempt,
          });
          toast.success('Producto actualizado');
        } else {
          await createProductAction({
            tenantSlug,
            name,
            description: description || undefined,
            unitPrice: Number(unitPrice),
            currency,
            taxExempt,
          });
          toast.success('Producto creado');
        }
        setOpen(false);
        resetForm();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al guardar el producto';
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="product-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del producto o servicio"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-description">Descripción</Label>
            <Textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="product-price">
                Precio unitario <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-currency">Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as 'PEN' | 'USD')}>
                <SelectTrigger id="product-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEN">PEN – Sol</SelectItem>
                  <SelectItem value="USD">USD – Dólar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
            <Switch id="product-tax-exempt" checked={taxExempt} onCheckedChange={setTaxExempt} />
            <div className="space-y-0.5">
              <Label htmlFor="product-tax-exempt" className="cursor-pointer">
                Sin IGV
              </Label>
              <p className="text-xs text-muted-foreground">
                Marca este producto como exonerado de impuesto
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !name.trim() || !unitPrice}
              className="min-w-24"
            >
              {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
