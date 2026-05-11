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

  function downloadCsv() {
    startTransition(async () => {
      try {
        const result = await getExportResult();
        const blob = new Blob(['\uFEFF' + result.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${result.filename}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo exportar el reporte');
      }
    });
  }

  function downloadXlsx() {
    startTransition(async () => {
      try {
        const result = await getExportResult();
        const XLSX = await import('xlsx');
        const worksheet = XLSX.utils.aoa_to_sheet(result.rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, result.sheetName);
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${result.filename}.xlsx`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo exportar el reporte');
      }
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
