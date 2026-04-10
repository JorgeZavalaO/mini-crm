'use client';

import { useState, useTransition } from 'react';
import { MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteProductAction, updateProductAction, type ProductRow } from '@/lib/product-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductFormDialog } from '@/components/products/product-form-dialog';

function formatMoney(value: number, currency: 'PEN' | 'USD') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

interface ProductListProps {
  products: ProductRow[];
  tenantSlug: string;
  canManage: boolean;
}

function ProductRowActions({ product, tenantSlug }: { product: ProductRow; tenantSlug: string }) {
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleToggleActive() {
    startTransition(async () => {
      try {
        await updateProductAction({
          tenantSlug,
          productId: product.id,
          isActive: !product.isActive,
        });
        toast.success(product.isActive ? 'Producto desactivado' : 'Producto activado');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al actualizar producto');
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteProductAction({ tenantSlug, productId: product.id });
        toast.success('Producto eliminado');
        setDeleteOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar producto');
      }
    });
  }

  return (
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" disabled={isPending}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ProductFormDialog
            tenantSlug={tenantSlug}
            product={product}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Pencil className="mr-2 size-3.5" />
                Editar
              </DropdownMenuItem>
            }
          />
          <DropdownMenuItem onClick={handleToggleActive}>
            <Power className="mr-2 size-3.5" />
            {product.isActive ? 'Desactivar' : 'Activar'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <Trash2 className="mr-2 size-3.5" />
              Eliminar
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará <strong>{product.name}</strong>. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Eliminando…' : 'Sí, eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ProductList({ products, tenantSlug, canManage }: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay productos en el catálogo aún.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="hidden sm:table-cell">Descripción</TableHead>
            <TableHead className="text-right">Precio unitario</TableHead>
            <TableHead className="text-center hidden md:table-cell">IGV</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            {canManage && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className={!product.isActive ? 'opacity-60' : undefined}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-xs truncate">
                {product.description ?? '—'}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatMoney(product.unitPrice, product.currency)}
              </TableCell>
              <TableCell className="text-center hidden md:table-cell">
                {product.taxExempt ? (
                  <Badge variant="outline" className="text-xs">
                    Sin IGV
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">18%</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={product.isActive ? 'default' : 'secondary'}>
                  {product.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              {canManage && (
                <TableCell>
                  <ProductRowActions product={product} tenantSlug={tenantSlug} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
