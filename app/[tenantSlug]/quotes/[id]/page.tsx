import Link from 'next/link';
import { ArrowLeft, CalendarDays, FileText, ScrollText, UserRound } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { getQuoteDetailAction } from '@/lib/quote-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QuoteEditDialog } from '@/components/quotes/quote-edit-dialog';
import { QuotePdfButton } from '@/components/quotes/quote-pdf-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatMoney(value: number, currency: 'PEN' | 'USD') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

const STATUS_LABEL = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
} as const;

function statusVariant(
  status: keyof typeof STATUS_LABEL,
): 'outline' | 'secondary' | 'default' | 'destructive' {
  if (status === 'ACEPTADA') return 'default';
  if (status === 'RECHAZADA') return 'destructive';
  if (status === 'ENVIADA') return 'secondary';
  return 'outline';
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = await params;
  const { tenant } = await requireTenantFeature(tenantSlug, 'QUOTING_BASIC');

  const [quote, leads, rawProducts] = await Promise.all([
    getQuoteDetailAction(id, tenantSlug).catch(() => null),
    db.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { businessName: 'asc' },
      take: 200,
      select: { id: true, businessName: true, ruc: true },
    }),
    db.product.findMany({
      where: { tenantId: tenant.id, deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      take: 200,
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        unitPrice: true,
        currency: true,
        taxExempt: true,
      },
    }),
  ]);
  if (!quote) notFound();

  const products = rawProducts.map((p) => ({
    ...p,
    unitPrice: Number(p.unitPrice),
    currency: p.currency as 'PEN' | 'USD',
    taxExempt: p.taxExempt,
  }));

  const canEdit = quote.status === 'BORRADOR' || quote.status === 'ENVIADA';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ScrollText className="size-5 text-primary" />
            <h1 className="text-2xl font-bold">{quote.quoteNumber}</h1>
            <Badge variant={statusVariant(quote.status)}>{STATUS_LABEL[quote.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Lead: {quote.lead.businessName} {quote.lead.ruc ? `· RUC ${quote.lead.ruc}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <QuoteEditDialog
              tenantSlug={tenantSlug}
              leads={leads}
              products={products}
              initialData={{
                quoteId: quote.id,
                quoteNumber: quote.quoteNumber,
                leadId: quote.lead.id,
                currency: quote.currency as 'PEN' | 'USD',
                taxRate: quote.taxRate,
                validUntil: quote.validUntil,
                notes: quote.notes,
                items: quote.items.map((item) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxExempt: item.taxExempt,
                })),
              }}
            />
          )}
          <QuotePdfButton
            quoteId={quote.id}
            tenantSlug={tenantSlug}
            quoteNumber={quote.quoteNumber}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${tenantSlug}/quotes`}>
              <ArrowLeft className="size-3.5" />
              Volver
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Moneda:</span> {quote.currency}
            </p>
            <p>
              <span className="text-muted-foreground">Subtotal:</span>{' '}
              {formatMoney(quote.subtotal, quote.currency)}
            </p>
            <p>
              <span className="text-muted-foreground">Impuesto:</span>{' '}
              {formatMoney(quote.taxAmount, quote.currency)} ({(quote.taxRate * 100).toFixed(2)}%)
            </p>
            <p className="font-semibold">
              <span className="text-muted-foreground">Total:</span>{' '}
              {formatMoney(quote.totalAmount, quote.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fechas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              Creada: {formatDateTime(quote.createdAt, tenant.companyTimezone)}
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              Vigencia:{' '}
              {quote.validUntil ? formatDate(quote.validUntil, tenant.companyTimezone) : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Autor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              {quote.createdBy?.name || quote.createdBy?.email}
            </p>
            {quote.notes && (
              <p className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 text-muted-foreground" />
                <span className="whitespace-pre-wrap">{quote.notes}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>Detalle de productos/servicios cotizados.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio Unitario</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.lineNumber}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity.toFixed(3)}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(item.unitPrice, quote.currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(item.lineSubtotal, quote.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
