'use client';

import { useRef, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UploadCloud, FileSpreadsheet, X } from 'lucide-react';
import { importLeadsAction, previewImportLeadsAction } from '@/lib/import-actions';
import { IMPORT_TEMPLATE_HEADERS } from '@/lib/import-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function outcomeLabel(outcome: ImportOutcome) {
  if (outcome === 'READY') return 'Listo';
  if (outcome === 'CREATED') return 'Creado';
  if (outcome === 'SKIPPED') return 'Omitido';
  return 'Error';
}

function outcomeVariant(
  outcome: ImportOutcome,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (outcome === 'READY' || outcome === 'CREATED') return 'default';
  if (outcome === 'SKIPPED') return 'outline';
  return 'destructive';
}

function SummaryCards({ items }: { items: Array<{ label: string; value: number }> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">{description}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fila</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow key={`${title}-${result.rowNumber}-${result.businessName}`}>
                <TableCell>{result.rowNumber}</TableCell>
                <TableCell className="font-medium">{result.businessName}</TableCell>
                <TableCell>
                  <Badge variant={outcomeVariant(result.outcome)}>
                    {outcomeLabel(result.outcome)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{result.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
      'Cliente demo',
      '+51 999 111 222',
      'ventas@acme.com',
      'NEW',
      'admin@acme.com',
    ],
    [
      'Importadora Norte',
      '',
      'Peru',
      'Piura',
      'Comercio exterior',
      'Referido',
      'Requiere seguimiento',
      '+51 955 123 456',
      'comercial@norte.com',
      'CONTACTED',
      '',
    ],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
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

  const hasCsv = csvText.trim().length > 0;

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
  const isPreviewCurrent = preview !== null && previewSnapshot === csvText;

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
        const result = await previewImportLeadsAction({ tenantSlug, csvText: csvText });
        setPreview({
          readyCount: result.readyCount,
          skippedCount: result.skippedCount,
          errorCount: result.errorCount,
          results: result.results,
        });
        setPreviewSnapshot(csvText);
        setSummary(null);
        toast.success(
          `Análisis listo: ${result.readyCount} fila(s) preparadas, ${result.skippedCount} omitidas y ${result.errorCount} con error`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo analizar el CSV';
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
          `Importación lista: ${result.createdCount} creados, ${result.skippedCount} omitidos, ${result.errorCount} con error`,
        );
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo importar el CSV';
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Carga tu archivo de leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Zona de carga */}
          <div
            className="relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-6 py-10 text-center transition-colors hover:border-muted-foreground/50"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (file) handleFileChange(file);
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
                if (file) handleFileChange(file);
              }}
            />
            {selectedFile ? (
              <>
                <FileSpreadsheet className="h-10 w-10 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB — listo para analizar
                  </p>
                </div>
              </>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-muted-foreground/60" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Arrastra tu archivo aquí o haz clic para seleccionarlo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Excel (.xlsx, .xls) o CSV — primera hoja
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={isPreviewPending || isImportPending || !hasCsv}
            >
              {isPreviewPending ? 'Analizando...' : 'Analizar archivo'}
            </Button>
            <Button type="button" variant="outline" onClick={onSubmit} disabled={!canImport}>
              {isImportPending ? 'Importando...' : 'Confirmar importación'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void downloadTemplate()}
              disabled={isPreviewPending || isImportPending}
            >
              Descargar plantilla
            </Button>
            {selectedFile && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={isPreviewPending || isImportPending}
              >
                <X className="mr-1 h-4 w-4" />
                Limpiar
              </Button>
            )}
          </div>

          <Alert>
            <AlertTitle>Flujo recomendado</AlertTitle>
            <AlertDescription>
              Primero analiza el archivo para detectar duplicados, owners inválidos y errores de
              formato. Cuando todo esté listo, confirma la importación.
            </AlertDescription>
          </Alert>

          {preview && !isPreviewCurrent && (
            <Alert>
              <AlertTitle>Archivo modificado</AlertTitle>
              <AlertDescription>
                El archivo cambió después del último análisis. Vuelve a ejecutar el preflight antes
                de confirmar.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {preview && (
        <div className="space-y-4">
          <SummaryCards
            items={[
              { label: 'Listos', value: preview.readyCount },
              { label: 'Omitidos', value: preview.skippedCount },
              { label: 'Errores', value: preview.errorCount },
            ]}
          />

          <ResultsTable
            title="Preflight de importación"
            description={`${totalPreviewed} fila(s) analizadas. La confirmación volverá a validar contra el estado actual del tenant.`}
            results={preview.results}
          />
        </div>
      )}

      {summary && (
        <div className="space-y-4">
          <SummaryCards
            items={[
              { label: 'Creados', value: summary.createdCount },
              { label: 'Omitidos', value: summary.skippedCount },
              { label: 'Errores', value: summary.errorCount },
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
