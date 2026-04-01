import { Package, Plus } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { buildSearchHref, firstSearchParam, getPaginationState } from '@/lib/pagination';
import { listProductsAction } from '@/lib/product-actions';
import { productFiltersSchema } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { ListPagination } from '@/components/ui/list-pagination';
import { ProductFormDialog } from '@/components/products/product-form-dialog';
import { ProductList } from '@/components/products/product-list';

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const [{ session, membership }, rawSearchParams] = await Promise.all([
    requireTenantFeature(tenantSlug, 'QUOTING_BASIC'),
    searchParams,
  ]);

  const isActiveParam = firstSearchParam(rawSearchParams.isActive);
  const parsedFilters = productFiltersSchema.safeParse({
    tenantSlug,
    q: firstSearchParam(rawSearchParams.q),
    currency: firstSearchParam(rawSearchParams.currency),
    isActive: isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined,
    page: firstSearchParam(rawSearchParams.page) ?? '1',
    pageSize: firstSearchParam(rawSearchParams.pageSize) ?? '20',
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : productFiltersSchema.parse({ tenantSlug, page: 1, pageSize: 20 });

  const role = membership?.role ?? null;
  const isSuperAdmin = session.user.isSuperAdmin;
  const canManage = isSuperAdmin || role === 'ADMIN' || role === 'SUPERVISOR';

  const { products, total } = await listProductsAction(filters).catch(() => ({
    products: [],
    total: 0,
  }));

  const pagination = getPaginationState({
    totalItems: total,
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const pageHref = (page: number) =>
    buildSearchHref(
      {
        q: filters.q,
        currency: filters.currency,
        isActive: filters.isActive,
        pageSize: filters.pageSize,
      },
      { page },
    );

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

      <p className="text-sm text-muted-foreground">
        {total} producto{total === 1 ? '' : 's'} registrado{total === 1 ? '' : 's'} en el catálogo.
      </p>

      <ProductList products={products} tenantSlug={tenantSlug} canManage={canManage} />

      <ListPagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={total}
        startItem={pagination.startItem}
        endItem={pagination.endItem}
        hrefForPage={pageHref}
      />
    </div>
  );
}
