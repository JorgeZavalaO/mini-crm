'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getQuoteDetailAction } from '@/lib/quote-actions';
import { Button } from '@/components/ui/button';

type Props = {
  quoteId: string;
  tenantSlug: string;
  quoteNumber?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
};

const STATUS_LABEL = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
} as const;

function fmt(value: number, currency: 'PEN' | 'USD') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function QuotePdfButton({
  quoteId,
  tenantSlug,
  variant = 'outline',
  size = 'sm',
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const quote = await getQuoteDetailAction(quoteId, tenantSlug);

      // Dynamic import — no aumenta el bundle inicial
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 18;

      // ── Encabezado con fondo ──────────────────────────────────────────────
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, pageW, 38, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('COTIZACIÓN', margin, 18);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.quoteNumber, margin, 26);

      // Estado en esquina derecha del header
      doc.setFontSize(10);
      doc.text(STATUS_LABEL[quote.status], pageW - margin, 18, { align: 'right' });
      doc.text(
        `Fecha: ${new Date(quote.createdAt).toLocaleDateString('es-PE')}`,
        pageW - margin,
        26,
        {
          align: 'right',
        },
      );

      // ── Sección cliente + info ────────────────────────────────────────────
      doc.setTextColor(30, 30, 40);
      let y = 50;

      // Columna izquierda: cliente
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('CLIENTE', margin, y);

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(quote.lead.businessName, margin, y);

      if (quote.lead.ruc) {
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`RUC: ${quote.lead.ruc}`, margin, y);
      }

      // Columna derecha: detalles
      const colRight = 120;
      let yr = 50;
      const detailPairs: [string, string][] = [
        ['Moneda', quote.currency === 'PEN' ? 'PEN – Sol peruano' : 'USD – Dólar americano'],
        ['IGV', `${(quote.taxRate * 100).toFixed(0)}%`],
      ];
      if (quote.validUntil) {
        detailPairs.push(['Válida hasta', new Date(quote.validUntil).toLocaleDateString('es-PE')]);
      }
      detailPairs.push(['Elaborado por', quote.createdBy?.name || quote.createdBy?.email || '']);

      for (const [label, value] of detailPairs) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), colRight, yr);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(value, colRight, yr + 4);
        yr += 11;
      }

      // Separador
      y = Math.max(y, yr) + 8;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      // ── Tabla de ítems ────────────────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['#', 'Descripción', 'Cantidad', 'Precio unit.', 'Subtotal']],
        body: quote.items.map((item) => [
          item.lineNumber,
          item.description,
          item.quantity.toFixed(3),
          fmt(item.unitPrice, quote.currency),
          fmt(item.lineSubtotal, quote.currency),
        ]),
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 3,
        },
        bodyStyles: { fontSize: 9, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { halign: 'right', cellWidth: 22 },
          3: { halign: 'right', cellWidth: 32 },
          4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
        },
      });

      // ── Totales ───────────────────────────────────────────────────────────

      const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY;
      let ty = afterTable + 8;
      const labelX = pageW - margin - 50;
      const valueX = pageW - margin;

      const rows: [string, string, boolean][] = [
        ['Subtotal', fmt(quote.subtotal, quote.currency), false],
        [
          `Impuesto (${(quote.taxRate * 100).toFixed(0)}%)`,
          fmt(quote.taxAmount, quote.currency),
          false,
        ],
      ];

      for (const [label, value, bold] of rows) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(label, labelX, ty);
        doc.setTextColor(15, 23, 42);
        doc.text(value, valueX, ty, { align: 'right' });
        ty += 6;
      }

      // Línea antes del total
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.5);
      doc.line(labelX - 2, ty - 1, valueX, ty - 1);
      ty += 3;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235);
      doc.text('TOTAL', labelX, ty);
      doc.text(fmt(quote.totalAmount, quote.currency), valueX, ty, { align: 'right' });

      // ── Notas ─────────────────────────────────────────────────────────────
      if (quote.notes) {
        ty += 14;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('NOTAS', margin, ty);
        ty += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const lines = doc.splitTextToSize(quote.notes, pageW - margin * 2) as string[];
        doc.text(lines, margin, ty);
      }

      // ── Footer ────────────────────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Generado el ${new Date().toLocaleString('es-PE')} · Mini CRM Logistic`,
          margin,
          doc.internal.pageSize.getHeight() - 8,
        );
        doc.text(
          `Página ${i} / ${totalPages}`,
          pageW - margin,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'right' },
        );
      }

      doc.save(`${quote.quoteNumber}.pdf`);
      toast.success(`PDF generado: ${quote.quoteNumber}.pdf`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo generar el PDF';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (size === 'icon') {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={handleDownload}
        disabled={loading}
        className={className}
        aria-label="Descargar PDF"
        title="Descargar PDF"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Generando…
        </>
      ) : (
        <>
          <Download className="mr-2 size-4" />
          Descargar PDF
        </>
      )}
    </Button>
  );
}
