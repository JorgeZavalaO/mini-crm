'use client';

import { useRef, useMemo, useState, useTransition } from 'react';
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
import { importLeadsAction, previewImportLeadsAction } from '@/lib/import-actions';
import { IMPORT_TEMPLATE_HEADERS } from '@/lib/import-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  businessName: string;
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

// ─── Outcome helpers ────────────────────────────────────────────────────────

type Step = 'upload' | 'analyze' | 'confirm' | 'done';

function outcomeLabel(outcome: ImportOutcome) {
  if (outcome === 'READY') return 'Listo';
  if (outcome === 'CREATED') return 'Creado';
  if (outcome === 'SKIPPED') return 'Omitido';
  return 'Error';
}

function outcomeBadgeClass(outcome: ImportOutcome) {
  if (outcome === 'READY' || outcome === 'CREATED')
    return 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400';
  if (outcome === 'SKIPPED')
    return 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  return 'border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400';
}

function outcomeRowClass(outcome: ImportOutcome) {
  if (outcome === 'READY' || outcome === 'CREATED') return 'bg-green-50/50 dark:bg-green-950/10';
  if (outcome === 'SKIPPED') return 'bg-amber-50/50 dark:bg-amber-950/10';
  return 'bg-red-50/50 dark:bg-red-950/10';
}

// ─── StepIndicator ───────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-1 text-xs">
      {STEPS.map((step, i) => {
        const stepIndex = STEP_ORDER.indexOf(step.id);
        const isDone = stepIndex < currentIndex;
        const isActive = step.id === current;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                isDone
                  ? 'bg-primary text-primary-foreground'
                  : isActive
                    ? 'border-2 border-primary text-primary'
                    : 'border border-muted-foreground/30 text-muted-foreground/40'
              }`}
            >
              {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`hidden sm:inline ${
                isActive
                  ? 'font-semibold text-foreground'
                  : isDone
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/40'
              }`}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <ArrowRight className="mx-0.5 h-3 w-3 shrink-0 text-muted-foreground/30" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SummaryCards ────────────────────────────────────────────────────────────

type SummaryItem = {
  label: string;
  value: number;
  color: 'green' | 'amber' | 'red';
  icon: React.ReactNode;
};

const COLOR_CARD: Record<SummaryItem['color'], string> = {
  green: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20',
  amber: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20',
  red: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
};

const COLOR_TEXT: Record<SummaryItem['color'], string> = {
  green: 'text-green-700 dark:text-green-400',
  amber: 'text-amber-700 dark:text-amber-400',
  red: 'text-red-700 dark:text-red-400',
};

function SummaryCards({ items }: { items: SummaryItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`flex items-center gap-4 rounded-lg border p-4 ${COLOR_CARD[item.color]}`}
        >
          <div className={`shrink-0 ${COLOR_TEXT[item.color]}`}>{item.icon}</div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className={`mt-1 text-3xl font-bold leading-none ${COLOR_TEXT[item.color]}`}>
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ResultsTable ────────────────────────────────────────────────────────────

function ResultsTable({
  title,
  description,
  results,
}: {
  title: string;
  description: string;
  results: ImportResult[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto rounded-b-lg">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-12 pl-4">Fila</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead className="w-24">Estado</TableHead>
                <TableHead className="pr-4">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow
                  key={`${title}-${result.rowNumber}-${result.businessName}`}
                  className={outcomeRowClass(result.outcome)}
                >
                  <TableCell className="pl-4 text-muted-foreground">{result.rowNumber}</TableCell>
                  <TableCell className="font-medium">{result.businessName}</TableCell>
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

async function downloadTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const worksheetData = [
    IMPORT_TEMPLATE_HEADERS as unknown as string[],
    [
      'Acme Logistics SAC',
      '20123456789',
      'Peru',
      'Lima',
      'Logistica',
      'Web',
      'Cliente potencial — seguimiento Q1',
      '+51 999 111 222',
      'ventas@acme.com',
      'NEW',
      '',
    ],
    [
      'Importadora Norte SRL',
      '20987654321',
      'Peru',
      'Piura',
      'Comercio exterior',
      'Referido',
      'Requiere cotización urgente',
      '+51 955 123 456',
      'comercial@norte.com',
      'CONTACTED',
      '',
    ],
    [
      'Distribuidora Sur EIRL',
      '',
      'Peru',
      'Arequipa',
      'Retail',
      'Llamada fría',
      '',
      '+51 922 000 111',
      '',
      'QUALIFIED',
      '',
    ],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet['!cols'] = ([...IMPORT_TEMPLATE_HEADERS] as string[]).map(() => ({ wch: 24 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
  XLSX.writeFile(workbook, 'plantilla-leads.xlsx');
}

export function ImportForm({ tenantSlug }: { tenantSlug: string }) {
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

  const currentStep: Step = summary
    ? 'done'
    : isPreviewCurrent && preview.readyCount > 0
      ? 'confirm'
      : hasCsv
        ? 'analyze'
        : 'upload';

  async function handleFileChange(file: File) {
    try {
      const text = await parseFile(file);
      setSelectedFile(file);
      setCsvText(text);
      setPreview(null);
      setSummary(null);
      setPreviewSnapshot('');
    } catch {
      toast.error(
        'No se pudo leer el archivo. Verifica que sea un Excel (.xlsx/.xls) o CSV válido.',
      );
    }
  }

  function handleClear() {
    setSelectedFile(null);
    setCsvText('');
    setPreview(null);
    setSummary(null);
    setPreviewSnapshot('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const totalPreviewed = useMemo(() => {
    if (!preview) return 0;
    return preview.readyCount + preview.skippedCount + preview.errorCount;
  }, [preview]);

  const totalProcessed = useMemo(() => {
    if (!summary) return 0;
    return summary.createdCount + summary.skippedCount + summary.errorCount;
  }, [summary]);

  const canImport = Boolean(
    isPreviewCurrent && preview.readyCount > 0 && !isImportPending && !isPreviewPending,
  );

  function handleAnalyze() {
    startPreviewTransition(async () => {
      try {
        const result = await previewImportLeadsAction({ tenantSlug, csvText });
        setPreview({
          readyCount: result.readyCount,
          skippedCount: result.skippedCount,
          errorCount: result.errorCount,
          results: result.results,
        });
        setPreviewSnapshot(csvText);
        setSummary(null);
        toast.success(
          `Análisis listo: ${result.readyCount} lista(s), ${result.skippedCount} omitida(s), ${result.errorCount} con error`,
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
        const result = await importLeadsAction({ tenantSlug, csvText });
        setSummary({
          createdCount: result.createdCount,
          skippedCount: result.skippedCount,
          errorCount: result.errorCount,
          results: result.results,
        });
        setPreview(null);
        setPreviewSnapshot('');
        toast.success(
          `Importación completa: ${result.createdCount} creado(s), ${result.skippedCount} omitido(s), ${result.errorCount} con error`,
        );
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo importar el archivo';
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Upload card ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Carga tu archivo</CardTitle>
              <CardDescription className="mt-1">
                Excel (.xlsx/.xls) o CSV — solo se lee la primera hoja
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void downloadTemplate()}
              disabled={isPreviewPending || isImportPending}
              className="shrink-0 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar plantilla
            </Button>
          </div>
          <Separator className="mt-3" />
          <div className="pt-1">
            <StepIndicator current={currentStep} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Drop zone */}
          <div
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 ${
              isDragging
                ? 'scale-[1.01] border-primary bg-primary/5'
                : selectedFile
                  ? 'border-green-400 bg-green-50/60 dark:border-green-700 dark:bg-green-950/20'
                  : 'border-muted-foreground/25 bg-muted/20 hover:border-muted-foreground/45 hover:bg-muted/40'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleFileChange(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={isPreviewPending || isImportPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileChange(file);
              }}
            />

            {isDragging ? (
              <>
                <UploadCloud className="h-12 w-12 animate-bounce text-primary" />
                <p className="text-sm font-semibold text-primary">Suelta el archivo aquí</p>
              </>
            ) : selectedFile ? (
              <>
                <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                  <FileSpreadsheet className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                    {' · '}
                    <span className="font-medium text-green-600 dark:text-green-400">
                      Listo para analizar
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-full bg-muted p-3">
                  <UploadCloud className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    Arrastra tu archivo aquí o{' '}
                    <span className="cursor-pointer text-primary underline underline-offset-2">
                      haz clic para seleccionar
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos admitidos: .xlsx · .xls · .csv
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
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
                  Analizando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Analizar archivo
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canImport}
              className={`gap-1.5 transition-colors ${
                canImport
                  ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600'
                  : ''
              }`}
              variant={canImport ? 'default' : 'outline'}
            >
              {isImportPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar importación
                </>
              )}
            </Button>

            {selectedFile && (
              <>
                <Separator orientation="vertical" className="h-6" />
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
              </>
            )}
          </div>

          {/* Contextual alerts */}
          {!hasCsv && (
            <Alert className="border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-300">Flujo de 2 pasos</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400">
                Primero <strong>analiza</strong> el archivo — detecta duplicados, owners inválidos y
                errores de formato. Luego <strong>confirma</strong> para crear solo las filas
                listas.
              </AlertDescription>
            </Alert>
          )}

          {preview && !isPreviewCurrent && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Archivo modificado</AlertTitle>
              <AlertDescription>
                El archivo cambió después del último análisis. Vuelve a analizar antes de confirmar.
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
                Solo se importarán las <strong>{preview.readyCount}</strong> fila(s) listas. Las{' '}
                <strong>{preview.errorCount}</strong> con error serán omitidas automáticamente.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ── Preview results ──────────────────────────────────────────── */}
      {preview && (
        <div className="space-y-4">
          <SummaryCards
            items={[
              {
                label: 'Listos para importar',
                value: preview.readyCount,
                color: 'green',
                icon: <CheckCircle2 className="h-7 w-7" />,
              },
              {
                label: 'Duplicados omitidos',
                value: preview.skippedCount,
                color: 'amber',
                icon: <AlertTriangle className="h-7 w-7" />,
              },
              {
                label: 'Con errores',
                value: preview.errorCount,
                color: 'red',
                icon: <AlertCircle className="h-7 w-7" />,
              },
            ]}
          />
          <ResultsTable
            title="Análisis previo (preflight)"
            description={`${totalPreviewed} fila(s) analizadas. La confirmación volverá a validar contra el estado actual del tenant.`}
            results={preview.results}
          />
        </div>
      )}

      {/* ── Final results ────────────────────────────────────────────── */}
      {summary && (
        <div className="space-y-4">
          <SummaryCards
            items={[
              {
                label: 'Leads creados',
                value: summary.createdCount,
                color: 'green',
                icon: <CheckCircle2 className="h-7 w-7" />,
              },
              {
                label: 'Duplicados omitidos',
                value: summary.skippedCount,
                color: 'amber',
                icon: <AlertTriangle className="h-7 w-7" />,
              },
              {
                label: 'Con errores',
                value: summary.errorCount,
                color: 'red',
                icon: <AlertCircle className="h-7 w-7" />,
              },
            ]}
          />
          <ResultsTable
            title="Resultado de la importación"
            description={`${totalProcessed} fila(s) procesadas en esta ejecución.`}
            results={summary.results}
          />
        </div>
      )}
    </div>
  );
}
