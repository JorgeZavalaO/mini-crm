'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  previewBulkAssignByRucAction,
  executeBulkAssignByRucAction,
  type RucAssignmentPreviewRow,
} from '@/lib/lead-actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Template download ───────────────────────────────────────────────────────

async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const rows = [
    { ruc: '20123456789', email: 'vendedor@empresa.com' },
    { ruc: '20987654321', email: 'otro@empresa.com' },
  ];
  const ws = XLSX.utils.json_to_sheet(rows, { header: ['ruc', 'email'] });
  ws['!cols'] = [{ wch: 20 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, 'plantilla-asignacion-ruc.xlsx');
}

// ─── Excel / CSV parsing ────────────────────────────────────────────────────

const RUC_ALIASES = new Set(['ruc', 'codigo', 'code', 'company_ruc', 'companyruc']);
const EMAIL_ALIASES = new Set([
  'owneremail',
  'owner_email',
  'responsable',
  'email',
  'correo',
  'email_responsable',
  'correo_responsable',
  'asignar_a',
]);

type ParsedRow = { ruc: string; ownerEmail: string };

async function parseFile(file: File): Promise<ParsedRow[]> {
  let csvText: string;

  if (file.name.toLowerCase().endsWith('.csv')) {
    csvText = await file.text();
  } else {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    csvText = XLSX.utils.sheet_to_csv(worksheet);
  }

  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('El archivo debe tener encabezado y al menos una fila.');

  const headers = lines[0].split(',').map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ''),
  );
  const rucIdx = headers.findIndex((h) => RUC_ALIASES.has(h));
  const emailIdx = headers.findIndex((h) => EMAIL_ALIASES.has(h));

  if (rucIdx === -1)
    throw new Error('No se encontró columna de RUC. Usa el encabezado: ruc, codigo o company_ruc.');
  if (emailIdx === -1)
    throw new Error(
      'No se encontró columna de correo. Usa el encabezado: email, correo, responsable o owner_email.',
    );

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const ruc = cols[rucIdx]?.trim().replace(/^"|"$/g, '') ?? '';
    const ownerEmail = cols[emailIdx]?.trim().replace(/^"|"$/g, '') ?? '';
    if (ruc && ownerEmail) rows.push({ ruc, ownerEmail });
  }

  if (rows.length === 0) throw new Error('No se encontraron filas válidas en el archivo.');
  return rows;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<RucAssignmentPreviewRow['status'], string> = {
  READY: 'Listo',
  LEAD_NOT_FOUND: 'RUC no encontrado',
  OWNER_NOT_FOUND: 'Correo no encontrado',
  ALREADY_ASSIGNED: 'Ya asignado',
};

const STATUS_VARIANT: Record<
  RucAssignmentPreviewRow['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  READY: 'default',
  LEAD_NOT_FOUND: 'destructive',
  OWNER_NOT_FOUND: 'destructive',
  ALREADY_ASSIGNED: 'secondary',
};

// ─── Component ───────────────────────────────────────────────────────────────

interface BulkAssignByRucDialogProps {
  tenantSlug: string;
}

type Step = 'upload' | 'preview' | 'done';

export function BulkAssignByRucDialog({ tenantSlug }: BulkAssignByRucDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [isPending, startTransition] = useTransition();
  const [previewRows, setPreviewRows] = useState<RucAssignmentPreviewRow[]>([]);
  const [summary, setSummary] = useState({
    readyCount: 0,
    notFoundCount: 0,
    ownerNotFoundCount: 0,
    alreadyAssignedCount: 0,
  });
  const [fileError, setFileError] = useState<string | null>(null);

  function resetDialog() {
    setStep('upload');
    setPreviewRows([]);
    setSummary({ readyCount: 0, notFoundCount: 0, ownerNotFoundCount: 0, alreadyAssignedCount: 0 });
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetDialog();
    setOpen(next);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      try {
        const rows = await parseFile(file);
        const result = await previewBulkAssignByRucAction({ tenantSlug, rows });
        setPreviewRows(result.rows);
        setSummary({
          readyCount: result.readyCount,
          notFoundCount: result.notFoundCount,
          ownerNotFoundCount: result.ownerNotFoundCount,
          alreadyAssignedCount: result.alreadyAssignedCount,
        });
        setStep('preview');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al procesar el archivo';
        setFileError(msg);
      }
    });
  }

  function handleConfirm() {
    const readyAssignments = previewRows
      .filter((r) => r.status === 'READY' && r.leadId && r.ownerId)
      .map((r) => ({ leadId: r.leadId!, ownerId: r.ownerId! }));

    if (readyAssignments.length === 0) {
      toast.info('No hay asignaciones que ejecutar.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await executeBulkAssignByRucAction({
          tenantSlug,
          assignments: readyAssignments,
        });
        toast.success(`${result.updatedCount} lead(s) asignados correctamente`);
        setStep('done');
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al ejecutar las asignaciones';
        toast.error(msg);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Asignar por Excel
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>Asignar leads por Excel</DialogTitle>
              <DialogDescription>
                Sube un archivo <strong>.xlsx</strong> o <strong>.csv</strong> con dos columnas:{' '}
                <code>ruc</code> (RUC de la empresa) y <code>email</code> (correo del responsable).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="mb-3 text-sm text-muted-foreground">
                  Formato esperado: columnas <strong>ruc</strong> y <strong>email</strong> (también
                  acepta: <em>correo, responsable, owner_email</em>)
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    id="ruc-import-file"
                    onChange={handleFileChange}
                    disabled={isPending}
                  />
                  <label htmlFor="ruc-import-file">
                    <Button type="button" variant="secondary" disabled={isPending} asChild>
                      <span>{isPending ? 'Procesando...' : 'Seleccionar archivo'}</span>
                    </Button>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={downloadTemplate}
                    disabled={isPending}
                  >
                    Descargar plantilla
                  </Button>
                </div>
              </div>

              {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>Vista previa de asignaciones</DialogTitle>
              <DialogDescription>Revisa los resultados antes de confirmar.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-3 py-2">
              <Badge variant="default">{summary.readyCount} listos</Badge>
              {summary.notFoundCount > 0 && (
                <Badge variant="destructive">{summary.notFoundCount} RUC no encontrado</Badge>
              )}
              {summary.ownerNotFoundCount > 0 && (
                <Badge variant="destructive">
                  {summary.ownerNotFoundCount} correo no encontrado
                </Badge>
              )}
              {summary.alreadyAssignedCount > 0 && (
                <Badge variant="secondary">{summary.alreadyAssignedCount} ya asignado</Badge>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RUC</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{row.ruc}</TableCell>
                      <TableCell className="text-sm">{row.leadName ?? '—'}</TableCell>
                      <TableCell className="text-sm">
                        {row.ownerName ? `${row.ownerName} (${row.ownerEmail})` : row.ownerEmail}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')} disabled={isPending}>
                Volver
              </Button>
              <Button onClick={handleConfirm} disabled={isPending || summary.readyCount === 0}>
                {isPending ? 'Asignando...' : `Confirmar ${summary.readyCount} asignaciones`}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>Asignaciones completadas</DialogTitle>
              <DialogDescription>Los leads fueron asignados correctamente.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
