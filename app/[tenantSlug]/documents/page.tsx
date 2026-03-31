import { FileText } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { listTenantDocumentsAction } from '@/lib/document-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentList } from '@/components/documents/document-list';
import { DocumentUploadZone } from '@/components/documents/document-upload-zone';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, membership } = await requireTenantFeature(tenantSlug, 'DOCUMENTS');

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
  };

  const { docs: documents } = await listTenantDocumentsAction(tenantSlug).catch(() => ({
    docs: [],
    total: 0,
  }));

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
            {documents.length > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {documents.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Documentos generales del workspace, sin asociar a ningún lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DocumentList
            docs={documents}
            tenantSlug={tenantSlug}
            currentUserId={actor.userId}
            currentRole={actor.role}
            isSuperAdmin={actor.isSuperAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
