'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  importInteractionsAction,
  previewImportInteractionsAction,
} from '@/lib/interaction-import-actions';
import { formatDateTime } from '@/lib/date-utils';
import { useTenant } from '@/lib/tenant-context';
import { cn } from '@/lib/utils';
import {
  INTERACTION_IMPORT_TEMPLATE_HEADERS,
  INTERACTION_IMPORT_TEMPLATE_HEADERS_MULTIPLE,
} from '@/lib/interaction-import-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

type ImportOutcome = 'READY' | 'CREATED' | 'SKIPPED' | 'ERROR';

type ImportResult = {
  rowNumber: number;
  ruc: string;
  businessName: string;
  authorEmail: string;
  type: string;
  occurredAt: string;
  outcome: ImportOutcome;
  message: string;
};

type ImportPreview = {
  readyCount: number;
  skippedCount: number;
  errorCount: number;
  results: ImportResult[];
};

type ImportSummary = {
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  results: ImportResult[];
};

type Step = 'upload' | 'analyze' | 'confirm' | 'done';

const TYPE_LABEL: Record<string, string> = {
  CALL: 'Llamada',
  EMAIL: 'Correo',
  NOTE: 'Nota',
  VISIT: 'Visita',
  WHATSAPP: 'WhatsApp',
};

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Subir' },
  { id: 'analyze', label: 'Analizar' },
  { id: 'confirm', label: 'Confirmar' },
  { id: 'done', label: 'Listo' },
];
const STEP_ORDER: Step[] = ['upload', 'analyze', 'confirm', 'done'];

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {STEPS.map((step, index) => {
        const stepIndex = STEP_ORDER.indexOf(step.id);
        const isDone = stepIndex < currentIndex;
        const isActive = step.id === current;

        return (
          <div key={step.id} className="flex items-center gap-1">
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                isDone
                  ? 'bg-primary text-primary-foreground'
                  : isActive
                    ? 'border-2 border-primary bg-background text-primary'
                    : 'border text-muted-foreground/50',
              )}
            >
              {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <span
              className={cn(
                'hidden sm:inline',
                isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <ArrowRight className="mx-0.5 h-3 w-3 shrink-0 text-muted-foreground/35" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function outcomeLabel(outcome: ImportOutcome) {
  if (outcome === 'READY') return 'Listo';
  if (outcome === 'CREATED') return 'Creado';
  if (outcome === 'SKIPPED') return 'Omitido';
  return 'Error';
}

function outcomeBadgeClass(outcome: ImportOutcome) {
  if (outcome === 'READY' || outcome === 'CREATED') {
    return 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  if (outcome === 'SKIPPED') {
    return 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  }
  return 'border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400';
}

function outcomeRowClass(outcome: ImportOutcome) {
  if (outcome === 'READY' || outcome === 'CREATED') {
    return 'bg-green-50/50 dark:bg-green-950/10';
  }
  if (outcome === 'SKIPPED') return 'bg-amber-50/50 dark:bg-amber-950/10';
  return 'bg-red-50/50 dark:bg-red-950/10';
}

async function parseFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return file.text();
  }

  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  return XLSX.utils.sheet_to_csv(worksheet);
}

function buildTemplateRows(sampleAuthorEmail: string) {
  return [
    INTERACTION_IMPORT_TEMPLATE_HEADERS as unknown as string[],
    [
      '20123456789',
      sampleAuthorEmail,
      'CALL',
      '2026-03-30 10:00',
      'Llamada inicial',
      'Cliente solicita cotizacion para importacion.',
    ],
    [
      '20123456789',
      sampleAuthorEmail,
      'WHATSAPP',
      '2026-03-28',
      'Seguimiento',
      'Envia documentos por WhatsApp.',
    ],
    [
      '20987654321',
      sampleAuthorEmail,
      'Correo',
      '27/03/2026 15:30',
      'Envio de informacion',
      'Se envio brochure comercial.',
    ],
  ];
}

function buildTemplateRowsMultiple(sampleAuthorEmail: string) {
  return [
    INTERACTION_IMPORT_TEMPLATE_HEADERS_MULTIPLE as unknown as string[],
    [
      '20123456789',
      sampleAuthorEmail,
      'Correo;WhatsApp;Llamada',
      '2026-03-30',
      'Envio de documentos;Seguimiento;Contacto telefónico',
      'Documentos de importacion;Cliente solicita cotizacion;Acordar proxima reunion',
    ],
    [
      '20987654321',
      sampleAuthorEmail,
      'EMAIL;EMAIL',
      '2026-03-29',
      'Propuesta;Confirmacion',
      'Se envio propuesta inicial;Cliente confirmo interes',
    ],
  ];
}

async function downloadTemplate(sampleAuthorEmail: string): Promise<void> {
  const XLSX = await import('xlsx');

  const worksheet1 = XLSX.utils.aoa_to_sheet(buildTemplateRows(sampleAuthorEmail));
  worksheet1['!cols'] = ([...INTERACTION_IMPORT_TEMPLATE_HEADERS] as string[]).map(() => ({
    wch: 26,
  }));

  const worksheet2 = XLSX.utils.aoa_to_sheet(buildTemplateRowsMultiple(sampleAuthorEmail));
  worksheet2['!cols'] = ([...INTERACTION_IMPORT_TEMPLATE_HEADERS_MULTIPLE] as string[]).map(() => ({
    wch: 26,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet1, 'Interacciones Simples');
  XLSX.utils.book_append_sheet(workbook, worksheet2, 'Multiples por linea');
  XLSX.writeFile(workbook, 'plantilla-interacciones.xlsx');
}

function ResultsTable({
  title,
  description,
  results,
}: {
  title: string;
  description: string;
  results: ImportResult[];
}) {
  const { tenant } = useTenant();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto rounded-b-lg">
          <Table className="min-w-[980px]">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-12 pl-4">Fila</TableHead>
                <TableHead className="w-32 font-mono text-xs">RUC</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead className="w-36">Fecha</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="pr-4">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow
                  key={`${title}-${result.rowNumber}-${result.ruc}-${result.authorEmail}`}
                  className={outcomeRowClass(result.outcome)}
                >
                  <TableCell className="pl-4 text-muted-foreground">{result.rowNumber}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {result.ruc || <span className="italic opacity-40">-</span>}
                  </TableCell>
                  <TableCell className="font-medium">{result.businessName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {result.authorEmail || <span className="italic opacity-40">-</span>}
                  </TableCell>
                  <TableCell>{TYPE_LABEL[result.type] ?? result.type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {result.occurredAt
                      ? formatDateTime(new Date(result.occurredAt), tenant.timezone)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={outcomeBadgeClass(result.outcome)}>
                      {outcomeLabel(result.outcome)}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-xs text-muted-foreground">
                    {result.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCards({
  readyLabel,
  readyCount,
  skippedCount,
  errorCount,
}: {
  readyLabel: string;
  readyCount: number;
  skippedCount: number;
  errorCount: number;
}) {
  const items = [
    {
      label: readyLabel,
      value: readyCount,
      icon: <CheckCircle2 className="h-6 w-6" />,
      className: 'border-green-200 bg-green-50 text-green-700',
    },
    {
      label: 'Omitidos',
      value: skippedCount,
      icon: <AlertTriangle className="h-6 w-6" />,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    {
      label: 'Con errores',
      value: errorCount,
      icon: <AlertCircle className="h-6 w-6" />,
      className: 'border-red-200 bg-red-50 text-red-700',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn('flex items-center gap-3 rounded-lg border p-3.5', item.className)}
        >
          <div className="shrink-0">{item.icon}</div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-bold leading-none">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImportInteractionsForm({
  tenantSlug,
  sampleAuthorEmail,
}: {
  tenantSlug: string;
  sampleAuthorEmail: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const hasCsv = csvText.trim().length > 0;
  const isPreviewCurrent = preview !== null && previewSnapshot === csvText;
  const canImport = Boolean(
    isPreviewCurrent && preview.readyCount > 0 && !isImportPending && !isPreviewPending,
  );
  const currentStep: Step = summary
    ? 'done'
    : isPreviewCurrent && preview.readyCount > 0
      ? 'confirm'
      : hasCsv
        ? 'analyze'
        : 'upload';
  const totalPreviewed = useMemo(() => {
    if (!preview) return 0;
    return preview.readyCount + preview.skippedCount + preview.errorCount;
  }, [preview]);
  const totalProcessed = useMemo(() => {
    if (!summary) return 0;
    return summary.createdCount + summary.skippedCount + summary.errorCount;
  }, [summary]);

  function resetAnalysis() {
    setPreview(null);
    setSummary(null);
    setPreviewSnapshot('');
  }

  async function handleFileChange(file: File) {
    try {
      const text = await parseFile(file);
      setSelectedFile(file);
      setCsvText(text);
      resetAnalysis();
    } catch {
      toast.error('No se pudo leer el archivo. Verifica que sea Excel o CSV valido.');
    }
  }

  function handleClear() {
    setSelectedFile(null);
    setCsvText('');
    resetAnalysis();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleAnalyze() {
    const snapshot = csvText;

    startPreviewTransition(async () => {
      try {
        const result = await previewImportInteractionsAction({ tenantSlug, csvText });
        setPreview({
          readyCount: result.readyCount,
          skippedCount: result.skippedCount,
          errorCount: result.errorCount,
          results: result.results,
        });
        setPreviewSnapshot(snapshot);
        setSummary(null);
        toast.success(
          `Analisis listo: ${result.readyCount} lista(s), ${result.skippedCount} omitida(s), ${result.errorCount} con error`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo analizar el archivo';
        toast.error(message);
      }
    });
  }

  function onSubmit() {
    startImportTransition(async () => {
      try {
        const result = await importInteractionsAction({ tenantSlug, csvText });
        const nextSummary = {
          createdCount: result.createdCount,
          skippedCount: result.skippedCount,
          errorCount: result.errorCount,
          results: result.results,
        };

        setSummary(nextSummary);
        setPreview(null);
        setPreviewSnapshot('');
        toast.success(
          `Importacion completa: ${result.createdCount} creada(s), ${result.skippedCount} omitida(s), ${result.errorCount} con error`,
        );
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo procesar el archivo';
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Archivo de interacciones</CardTitle>
              <CardDescription className="mt-1">
                Excel (.xlsx/.xls) o CSV. Soporta interacción individual o múltiples por línea
                (separadas por ;). Se valida cada fila antes de guardar.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedFile && (
                <Badge variant="secondary" className="gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  Archivo cargado
                </Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void downloadTemplate(sampleAuthorEmail)}
                disabled={isPreviewPending || isImportPending}
                className="shrink-0 gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar plantilla
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/25 px-3 py-2.5">
            <StepIndicator current={currentStep} />
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-0">
          <div
            className={cn(
              'relative flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200',
              isDragging
                ? 'scale-[1.01] border-primary bg-primary/5'
                : selectedFile
                  ? 'border-green-400 bg-green-50/60 dark:border-green-700 dark:bg-green-950/20'
                  : 'border-muted-foreground/25 bg-muted/20 hover:border-muted-foreground/45 hover:bg-muted/40',
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void handleFileChange(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={isPreviewPending || isImportPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFileChange(file);
              }}
            />

            {isDragging ? (
              <>
                <UploadCloud className="h-12 w-12 animate-bounce text-primary" />
                <p className="text-sm font-semibold text-primary">Suelta el archivo aqui</p>
              </>
            ) : selectedFile ? (
              <>
                <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                  <FileSpreadsheet className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB - listo para analizar
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-full bg-muted p-3">
                  <UploadCloud className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">
                    Arrastra tu archivo aqui o{' '}
                    <span className="cursor-pointer text-primary underline underline-offset-2">
                      haz clic para seleccionar
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos admitidos: .xlsx - .xls - .csv. Solo se lee la primera hoja.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {isPreviewCurrent
                ? `${preview.readyCount} fila(s) listas para confirmar.`
                : hasCsv
                  ? 'Analiza el archivo para validar RUC, autor, tipo y fecha.'
                  : 'Descarga la plantilla o sube un archivo con los encabezados requeridos.'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={isPreviewPending || isImportPending || !hasCsv}
                className="gap-1.5"
              >
                {isPreviewPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Analizar
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={onSubmit}
                disabled={!canImport}
                variant={canImport ? 'default' : 'outline'}
                className="gap-1.5"
              >
                {isImportPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar
                  </>
                )}
              </Button>

              {selectedFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={isPreviewPending || isImportPending}
                  className="gap-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {!hasCsv && (
            <Alert className="border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-300">Flujo de 2 pasos</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400">
                Primero analiza el archivo. Luego confirma para procesar solo las filas listas.
              </AlertDescription>
            </Alert>
          )}

          {preview && !isPreviewCurrent && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Archivo modificado</AlertTitle>
              <AlertDescription>
                Vuelve a analizar antes de confirmar para trabajar con los datos actuales.
              </AlertDescription>
            </Alert>
          )}

          {isPreviewCurrent && preview.errorCount > 0 && (
            <Alert className="border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-800 dark:text-amber-300">
                Hay filas con errores
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                Solo se procesaran las {preview.readyCount} fila(s) listas.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {preview && (
        <div className="flex flex-col gap-4">
          <SummaryCards
            readyLabel="Listas para importar"
            readyCount={preview.readyCount}
            skippedCount={preview.skippedCount}
            errorCount={preview.errorCount}
          />
          <ResultsTable
            title="Analisis previo"
            description={`${totalPreviewed} fila(s) analizadas. La confirmacion volvera a validar contra el estado actual del tenant.`}
            results={preview.results}
          />
        </div>
      )}

      {summary && (
        <div className="flex flex-col gap-4">
          <SummaryCards
            readyLabel="Interacciones creadas"
            readyCount={summary.createdCount}
            skippedCount={summary.skippedCount}
            errorCount={summary.errorCount}
          />
          <ResultsTable
            title="Resultado del proceso"
            description={`${totalProcessed} fila(s) procesadas en esta ejecucion.`}
            results={summary.results}
          />
        </div>
      )}
    </div>
  );
}
