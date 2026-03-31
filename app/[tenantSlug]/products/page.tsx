import { Package, Plus } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { listProductsAction } from '@/lib/product-actions';
import { Button } from '@/components/ui/button';
import { ProductFormDialog } from '@/components/products/product-form-dialog';
import { ProductList } from '@/components/products/product-list';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, membership } = await requireTenantFeature(tenantSlug, 'QUOTING_BASIC');

  const role = membership?.role ?? null;
  const isSuperAdmin = session.user.isSuperAdmin;
  const canManage = isSuperAdmin || role === 'ADMIN' || role === 'SUPERVISOR';

  const { products } = await listProductsAction({
    tenantSlug,
    page: 1,
    pageSize: 200,
  }).catch(() => ({ products: [], total: 0 }));

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Package className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Catálogo de productos</h1>
            <p className="text-sm text-muted-foreground">
              Administra los productos y servicios para tus cotizaciones.
            </p>
          </div>
        </div>

        {canManage && (
          <ProductFormDialog
            tenantSlug={tenantSlug}
            trigger={
              <Button>
                <Plus className="mr-2 size-4" />
                Nuevo producto
              </Button>
            }
          />
        )}
      </div>

      <ProductList products={products} tenantSlug={tenantSlug} canManage={canManage} />
    </div>
  );
}
