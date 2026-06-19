'use client';

import { useTransition } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  exportSuperadminReportsAction,
  exportTenantReportsAction,
} from '@/lib/reporting/report-actions';

export function ReportExportButton({
  mode,
  payload,
  label = 'Exportar',
}: {
  mode: 'tenant' | 'superadmin';
  payload: Record<string, unknown>;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  async function getExportResult() {
    return mode === 'tenant'
      ? exportTenantReportsAction(payload)
      : exportSuperadminReportsAction(payload);
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function runExport(handler: () => Promise<void>) {
    startTransition(async () => {
      try {
        await handler();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo exportar el reporte');
      }
    });
  }

  function downloadCsv() {
    runExport(async () => {
      const result = await getExportResult();
      downloadBlob(
        new Blob(['\uFEFF' + result.csv], { type: 'text/csv;charset=utf-8;' }),
        `${result.filename}.csv`,
      );
    });
  }

  function downloadXlsx() {
    runExport(async () => {
      const result = await getExportResult();
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet(result.rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, result.sheetName);
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      downloadBlob(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `${result.filename}.xlsx`,
      );
    });
  }

  function downloadPdf() {
    runExport(async () => {
      const result = await getExportResult();
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(result.title, 40, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Generado: ${result.generatedAtLabel}`, 40, 68);
      doc.text(`Rango: ${result.rangeLabel}`, 40, 82);
      if (result.comparisonRangeLabel) {
        doc.text(`Comparado: ${result.comparisonRangeLabel}`, 40, 96);
      }
      if (result.contextLine) {
        doc.text(result.contextLine, 40, 110);
      }

      let cursorY = result.contextLine ? 128 : 112;

      for (const section of result.sections) {
        if (cursorY > 760) {
          doc.addPage();
          cursorY = 50;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(section.title, 40, cursorY);
        cursorY += 8;
        autoTable(doc, {
          startY: cursorY + 4,
          margin: { left: 40, right: 40 },
          head: [section.header],
          body: section.rows,
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY;
        cursorY = (finalY ?? cursorY) + 24;
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i += 1) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(
          `Página ${i} de ${totalPages} · ${result.title}`,
          pageWidth - 40,
          doc.internal.pageSize.getHeight() - 20,
          { align: 'right' },
        );
      }

      const pdfBlob = doc.output('blob');
      downloadBlob(pdfBlob, `${result.filename}.pdf`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          <Download className="mr-2 h-4 w-4" />
          {isPending ? 'Exportando...' : label}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={downloadCsv}>CSV (.csv)</DropdownMenuItem>
        <DropdownMenuItem onClick={downloadXlsx}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={downloadPdf}>PDF (.pdf)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
