'use client';

import { useTransition } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportLeadsAction } from '@/lib/lead-actions';

interface LeadExportButtonProps {
  tenantSlug: string;
}

export function LeadExportButton({ tenantSlug }: LeadExportButtonProps) {
  const [isPending, startTransition] = useTransition();

  function downloadCsv() {
    startTransition(async () => {
      const result = await exportLeadsAction(tenantSlug);
      const blob = new Blob(['\uFEFF' + result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function downloadXlsx() {
    startTransition(async () => {
      const result = await exportLeadsAction(tenantSlug);
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet(result.rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename + '.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          <Download className="mr-2 h-4 w-4" />
          {isPending ? 'Exportando...' : 'Exportar leads'}
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
