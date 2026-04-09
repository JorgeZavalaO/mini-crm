import { FileText } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { buildSearchHref, firstSearchParam, getPaginationState } from '@/lib/pagination';
import { listTenantDocumentsAction, type DocumentRow } from '@/lib/document-actions';
import { documentFiltersSchema } from '@/lib/validators';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentList } from '@/components/documents/document-list';
import { DocumentUploadZone } from '@/components/documents/document-upload-zone';
import { ListPagination } from '@/components/ui/list-pagination';

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const [{ session, membership }, rawSearchParams] = await Promise.all([
    requireTenantFeature(tenantSlug, 'DOCUMENTS'),
    searchParams,
  ]);

  const parsedFilters = documentFiltersSchema.safeParse({
    tenantSlug,
    page: firstSearchParam(rawSearchParams.page) ?? '1',
    pageSize: firstSearchParam(rawSearchParams.pageSize) ?? '20',
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : documentFiltersSchema.parse({ tenantSlug, page: 1, pageSize: 20 });

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
  };

  let documents: DocumentRow[] = [];
  let total = 0;
  let loadError = false;
  try {
    const result = await listTenantDocumentsAction(tenantSlug, filters.page, filters.pageSize);
    documents = result.docs;
    total = result.total;
  } catch {
    loadError = true;
  }

  const pagination = getPaginationState({
    totalItems: total,
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const pageHref = (page: number) => buildSearchHref({ pageSize: filters.pageSize }, { page });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FileText className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">Documentos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Repositorio central de documentos del workspace. Sube contratos, propuestas y archivos
          generales no asociados a un lead específico.
        </p>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subir documento</CardTitle>
          <CardDescription>PDF, Word, Excel o imagen — máximo 5 MB por archivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentUploadZone tenantSlug={tenantSlug} />
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Todos los documentos
            {total > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {total}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Documentos del workspace. Los subidos desde un lead aparecen vinculados a él; los
            subidos desde esta página quedan como generales.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertDescription>
                  No se pudieron cargar los documentos. Intenta recargar la página.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <DocumentList
              docs={documents}
              tenantSlug={tenantSlug}
              currentUserId={actor.userId}
              currentRole={actor.role}
              isSuperAdmin={actor.isSuperAdmin}
              showLeadColumn={true}
            />
          )}

          <div className="px-6 pb-4">
            <ListPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={total}
              startItem={pagination.startItem}
              endItem={pagination.endItem}
              hrefForPage={pageHref}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
