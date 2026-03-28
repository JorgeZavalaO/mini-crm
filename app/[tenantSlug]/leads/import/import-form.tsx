'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { importLeadsAction, previewImportLeadsAction } from '@/lib/import-actions';
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
import { Textarea } from '@/components/ui/textarea';

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

export function ImportForm({ tenantSlug, sampleCsv }: { tenantSlug: string; sampleCsv: string }) {
  const router = useRouter();
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState('');

  const hasCsv = csvText.trim().length > 0;
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
          <CardTitle>Pega tu CSV y analízalo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder="Pega aquí tu CSV con encabezados"
            className="min-h-70 font-mono text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={isPreviewPending || isImportPending || !hasCsv}
            >
              {isPreviewPending ? 'Analizando...' : 'Analizar CSV'}
            </Button>
            <Button type="button" variant="outline" onClick={onSubmit} disabled={!canImport}>
              {isImportPending ? 'Importando...' : 'Confirmar importación'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCsvText(sampleCsv);
                setPreview(null);
                setSummary(null);
                setPreviewSnapshot('');
              }}
              disabled={isPreviewPending || isImportPending}
            >
              Cargar ejemplo
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCsvText('');
                setPreview(null);
                setSummary(null);
                setPreviewSnapshot('');
              }}
              disabled={isPreviewPending || isImportPending}
            >
              Limpiar
            </Button>
          </div>

          <Alert>
            <AlertTitle>Flujo recomendado</AlertTitle>
            <AlertDescription>
              Primero analiza el CSV para detectar duplicados, owners inválidos y errores de
              formato. Cuando todo esté listo, confirma la importación.
            </AlertDescription>
          </Alert>

          {preview && !isPreviewCurrent && (
            <Alert>
              <AlertTitle>CSV modificado</AlertTitle>
              <AlertDescription>
                El contenido cambió después del último análisis. Vuelve a ejecutar el preflight
                antes de confirmar.
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
