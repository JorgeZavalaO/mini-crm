import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { ArrowLeft, Download, FileSpreadsheet, Info, ListChecks, ScanSearch } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { canOwnLeads } from '@/lib/lead-owner';
import { canImportLeads } from '@/lib/lead-permissions';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { Badge } from '@/components/ui/badge';
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
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-7 w-7 shrink-0 text-primary" />
            <h1 className="text-3xl font-bold">Importación de leads</h1>
          </div>
          <p className="text-muted-foreground">
            Carga masiva desde Excel (.xlsx/.xls) o CSV con análisis de duplicados antes de
            confirmar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${tenantSlug}/leads`}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Volver a leads
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${tenantSlug}/leads/dedupe`}>
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
              Ir a duplicados
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ImportForm tenantSlug={tenantSlug} />

        <div className="space-y-5">
          {/* Template callout */}
          <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary/15 p-1.5">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-sm">Descarga la plantilla</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Usa el botón <strong className="text-foreground">Descargar plantilla</strong> del
              formulario para obtener un Excel con las columnas correctas y 3 filas de ejemplo
              listos para editar.
            </CardContent>
          </Card>

          {/* Columns table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm">Columnas del archivo</CardTitle>
              </div>
              <CardDescription>
                <code className="rounded bg-muted px-1 text-xs font-mono">businessName</code> es la
                única columna obligatoria.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Columna</TableHead>
                    <TableHead className="w-16">Req.</TableHead>
                    <TableHead className="pr-4">Descripción</TableHead>
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
                    <TableRow
                      key={col}
                      className={required ? 'bg-primary/5 dark:bg-primary/10' : ''}
                    >
                      <TableCell className="pl-4 font-mono text-xs font-medium">{col}</TableCell>
                      <TableCell>
                        {required ? (
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
                          >
                            Sí
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-xs text-muted-foreground">{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Operational notes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm">Notas operativas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                {[
                  'Solo se lee la primera hoja del archivo Excel.',
                  'Analiza primero para validar estructura, owners y detectar duplicados.',
                  'Confirma la importación: solo se crean las filas con estado "Listo".',
                  'Duplicados detectados por RUC, email o teléfono son omitidos automáticamente.',
                  <>
                    Para múltiples teléfonos/emails en una celda usa{' '}
                    <code className="rounded bg-muted px-1 text-xs">;</code> como separador.
                  </>,
                  <>
                    Estados válidos:{' '}
                    {['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'].map((s) => (
                      <code key={s} className="mr-1 rounded bg-muted px-1 text-xs">
                        {s}
                      </code>
                    ))}
                  </>,
                  <>
                    También en español:{' '}
                    {['Nuevo', 'Contactado', 'Calificado', 'Ganado', 'Perdido'].map((s) => (
                      <code key={s} className="mr-1 rounded bg-muted px-1 text-xs">
                        {s}
                      </code>
                    ))}
                  </>,
                ].map((note, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Assignable owners */}
          {assignableOwnerEmails.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Owners asignables</CardTitle>
                <CardDescription className="text-xs">
                  Usa estos correos en la columna{' '}
                  <code className="rounded bg-muted px-1 text-xs font-mono">ownerEmail</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {assignableOwnerEmails.map((email) => (
                    <li key={email} className="flex items-center gap-2 text-xs">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {email}
                    </li>
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
