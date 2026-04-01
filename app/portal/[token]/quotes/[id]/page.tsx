import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { getPortalDataByToken } from '@/lib/portal-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS_LABEL: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: React.ElementType;
  }
> = {
  ENVIADA: { label: 'Enviada', variant: 'outline', icon: Clock },
  ACEPTADA: { label: 'Aceptada', variant: 'default', icon: CheckCircle2 },
  RECHAZADA: { label: 'Rechazada', variant: 'destructive', icon: XCircle },
};

export default async function PortalQuoteDetailPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const data = await getPortalDataByToken(token);

  if (!data) return notFound();

  const quote = data.quotes.find((q) => q.id === id);
  if (!quote) return notFound();

  const statusCfg = STATUS_LABEL[quote.status] ?? STATUS_LABEL.ENVIADA;
  const StatusIcon = statusCfg.icon;

  const fmt = (amount: number) =>
    new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: quote.currency,
      minimumFractionDigits: 2,
    }).format(amount);

  return (
    <div className="space-y-6">
      <Link
        href={`/portal/${token}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a cotizaciones
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{quote.quoteNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {data.tenantName} · {data.leadName}
          </p>
        </div>
        <Badge variant={statusCfg.variant} className="text-sm">
          <StatusIcon className="mr-1.5 size-4" />
          {statusCfg.label}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de ítems</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">P. Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{fmt(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{fmt(item.lineSubtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-end border-t pt-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{fmt(quote.totalAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {quote.issuedAt && (
              <div>
                <dt className="text-muted-foreground">Fecha de emisión</dt>
                <dd className="font-medium">
                  {new Date(quote.issuedAt).toLocaleDateString('es-PE')}
                </dd>
              </div>
            )}
            {quote.validUntil && (
              <div>
                <dt className="text-muted-foreground">Válida hasta</dt>
                <dd className="font-medium">
                  {new Date(quote.validUntil).toLocaleDateString('es-PE')}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
