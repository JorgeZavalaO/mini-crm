import { requireTenantFeature } from '@/lib/auth-guard';

export default async function LeadsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  await requireTenantFeature(tenantSlug, 'CRM_LEADS');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Leads</h1>
      <p className="text-muted-foreground">
        La gestión de leads estará disponible en el próximo sprint.
      </p>
    </div>
  );
}
