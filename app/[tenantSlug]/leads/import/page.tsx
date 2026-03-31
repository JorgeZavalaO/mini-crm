import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { requireTenantFeature } from '@/lib/auth-guard';
import { canOwnLeads } from '@/lib/lead-owner';
import { canImportLeads } from '@/lib/lead-permissions';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
            Carga masiva de leads desde Excel (.xlsx) o CSV, con análisis de duplicados antes de
            confirmar.
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
        <ImportForm tenantSlug={tenantSlug} />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Columnas del archivo</CardTitle>
              <CardDescription>
                Descarga la plantilla desde el formulario. <code>businessName</code> es la única
                columna obligatoria.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Columna</TableHead>
                    <TableHead>Requerida</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { col: 'businessName', required: true, desc: 'Razón social o nombre del lead' },
                    { col: 'ruc', required: false, desc: 'RUC u otro identificador fiscal' },
                    { col: 'country', required: false, desc: 'País' },
                    { col: 'city', required: false, desc: 'Ciudad' },
                    { col: 'industry', required: false, desc: 'Rubro o sector' },
                    { col: 'source', required: false, desc: 'Fuente (Web, Referido…)' },
                    { col: 'notes', required: false, desc: 'Notas internas' },
                    { col: 'phones', required: false, desc: 'Teléfonos separados por ;' },
                    { col: 'emails', required: false, desc: 'Correos separados por ;' },
                    {
                      col: 'status',
                      required: false,
                      desc: 'NEW · CONTACTED · QUALIFIED · WON · LOST',
                    },
                    { col: 'ownerEmail', required: false, desc: 'Email del miembro asignado' },
                  ].map(({ col, required, desc }) => (
                    <TableRow key={col}>
                      <TableCell className="font-mono text-xs">{col}</TableCell>
                      <TableCell>
                        {required ? (
                          <span className="font-semibold text-primary">Sí</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas operativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>- Sube un Excel (.xlsx / .xls) o un CSV. Solo se lee la primera hoja.</p>
              <p>- Paso 1: analiza el archivo para validar estructura, owners y duplicados.</p>
              <p>- Paso 2: confirma la importación solo con las filas listas.</p>
              <p>- La importación omite duplicados detectados por RUC, email o teléfono.</p>
              <p>
                - Para múltiples teléfonos/emails en una celda usa <code>;</code> como separador.
              </p>
              <p>
                - Los estados válidos son: <code>NEW</code>, <code>CONTACTED</code>,{' '}
                <code>QUALIFIED</code>, <code>WON</code>, <code>LOST</code>.
              </p>
              <p>
                - También acepta etiquetas en español: <code>Nuevo</code>, <code>Contactado</code>,{' '}
                <code>Calificado</code>, <code>Ganado</code>, <code>Perdido</code>.
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
