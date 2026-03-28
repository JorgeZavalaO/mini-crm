import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { requireTenantFeature } from '@/lib/auth-guard';
import { canOwnLeads } from '@/lib/lead-owner';
import { canImportLeads } from '@/lib/lead-permissions';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { IMPORT_SAMPLE_CSV } from '@/lib/import-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImportForm } from './import-form';

export default async function LeadImportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant, membership, session } = await requireTenantFeature(tenantSlug, 'IMPORT');

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
    isActiveMember: session.user.isSuperAdmin || Boolean(membership?.isActive),
  };

  if (!canImportLeads(actor)) {
    forbidden();
  }

  const assignmentsEnabled = await isTenantFeatureEnabled(tenant.id, 'ASSIGNMENTS');
  const ownerRows = assignmentsEnabled
    ? await db.membership.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { role: true, user: { select: { email: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const assignableOwnerEmails = ownerRows
    .filter((membershipRow) => canOwnLeads(membershipRow.role))
    .map((membershipRow) => membershipRow.user.email);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Importación de leads</h1>
          <p className="text-muted-foreground">
            MVP de carga masiva por CSV pegado en texto, ahora con preflight antes de confirmar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${tenantSlug}/leads`}>Volver a leads</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${tenantSlug}/leads/dedupe`}>Ir a duplicados</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ImportForm tenantSlug={tenantSlug} sampleCsv={IMPORT_SAMPLE_CSV} />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Formato soportado</CardTitle>
              <CardDescription>
                Usa encabezados amigables o la plantilla base. `businessName` es obligatorio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-6">
                {IMPORT_SAMPLE_CSV}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas operativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>- Paso 1: analiza el CSV para validar estructura, owners y duplicados.</p>
              <p>- Paso 2: confirma la importación solo con las filas listas.</p>
              <p>- La importación omite duplicados detectados por RUC, email o teléfono.</p>
              <p>- Para múltiples teléfonos/emails en una celda usa `;` o salto de línea.</p>
              <p>- Los estados válidos son: `NEW`, `CONTACTED`, `QUALIFIED`, `WON`, `LOST`.</p>
              <p>
                - También acepta etiquetas en español: `Nuevo`, `Contactado`, `Calificado`,
                `Ganado`, `Perdido`.
              </p>
            </CardContent>
          </Card>

          {assignableOwnerEmails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Owners asignables</CardTitle>
                <CardDescription>
                  Usa estos correos en la columna `ownerEmail` si quieres importar con ownership.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {assignableOwnerEmails.map((email) => (
                    <li key={email}>{email}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
