import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { ArrowLeft, Download, FileSpreadsheet, Info, ListChecks } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { canImportLeads } from '@/lib/lead-permissions';
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
import { ImportInteractionsForm } from './import-interactions-form';

export default async function InteractionImportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant, membership, session } = await requireTenantFeature(tenantSlug, 'IMPORT');
  const [leadsEnabled, interactionsEnabled] = await Promise.all([
    isTenantFeatureEnabled(tenant.id, 'CRM_LEADS'),
    isTenantFeatureEnabled(tenant.id, 'INTERACTIONS'),
  ]);

  if (!leadsEnabled || !interactionsEnabled) {
    forbidden();
  }

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
    isActiveMember: session.user.isSuperAdmin || Boolean(membership?.isActive),
  };

  if (!canImportLeads(actor)) {
    forbidden();
  }

  const authorRows = await db.membership.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: {
      role: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const sampleAuthorEmail = authorRows[0]?.user.email ?? 'usuario@empresa.com';

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-7 w-7 shrink-0 text-primary" />
            <h1 className="text-3xl font-bold">Importacion de interacciones</h1>
          </div>
          <p className="text-muted-foreground">
            Carga historica desde Excel o CSV para registrar llamadas, correos, WhatsApp, visitas y
            notas con fecha anterior.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${tenantSlug}/leads`}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Volver a leads
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ImportInteractionsForm tenantSlug={tenantSlug} sampleAuthorEmail={sampleAuthorEmail} />

        <div className="flex flex-col gap-5">
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
              Usa la plantilla para mantener los encabezados correctos. Las fechas se interpretan en
              la zona horaria configurada de la empresa.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm">Columnas del archivo</CardTitle>
              </div>
              <CardDescription>
                Todas las filas se asocian por <code className="rounded bg-muted px-1">ruc</code> y
                el autor se toma de <code className="rounded bg-muted px-1">authorEmail</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Columna</TableHead>
                    <TableHead className="w-16">Req.</TableHead>
                    <TableHead className="pr-4">Descripcion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    {
                      col: 'ruc',
                      required: true,
                      desc: 'RUC del lead activo que recibira la interaccion.',
                    },
                    {
                      col: 'authorEmail',
                      required: true,
                      desc: 'Correo de un miembro activo del tenant que quedara como autor.',
                    },
                    {
                      col: 'type',
                      required: true,
                      desc: 'CALL, EMAIL, NOTE, VISIT o WHATSAPP. Tambien acepta llamada, correo, nota, visita y WhatsApp.',
                    },
                    {
                      col: 'occurredAt',
                      required: true,
                      desc: 'Fecha/hora historica. Ejemplos: 2026-03-30 10:00, 2026-03-28, 27/03/2026 15:30.',
                    },
                    {
                      col: 'subject',
                      required: false,
                      desc: 'Asunto breve opcional, maximo 200 caracteres.',
                    },
                    {
                      col: 'notes',
                      required: true,
                      desc: 'Detalle de la interaccion, maximo 5000 caracteres.',
                    },
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
                            Si
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-xs text-muted-foreground">{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm">Reglas operativas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                {[
                  'La carga no cambia el estado del lead ni su responsable.',
                  'Si el tipo no se reconoce pero no esta vacio, se guardara como NOTE.',
                  'Una fecha sin hora se guardara a las 00:00 en la zona horaria del tenant.',
                  'Las filas con RUC inexistente se omiten; las filas ambiguas o invalidas quedan con error.',
                  'La confirmacion vuelve a validar contra el estado actual antes de crear registros.',
                ].map((note, index) => (
                  <li key={note} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                      {index + 1}
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {authorRows.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Autores validos</CardTitle>
                <CardDescription className="text-xs">
                  Usa estos correos en la columna{' '}
                  <code className="rounded bg-muted px-1 font-mono">authorEmail</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1.5">
                  {authorRows.map((membershipRow) => (
                    <li
                      key={membershipRow.user.email}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 truncate">{membershipRow.user.email}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {membershipRow.role}
                      </Badge>
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
