import { requireTenantFeature } from '@/lib/auth-guard';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireTenantFeature(tenantSlug, 'DOCUMENTS');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Documentos</h1>
      <p className="text-muted-foreground">
        Este modulo esta habilitado, pero su gestion detallada se implementara en un sprint
        posterior.
      </p>
    </div>
  );
}
