import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { getPortalQuotesPageByToken } from '@/lib/portal-actions';
import { buildSearchHref, firstSearchParam, getPaginationState } from '@/lib/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListPagination } from '@/components/ui/list-pagination';

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

function parsePage(value: string | string[] | undefined) {
  const raw = firstSearchParam(value);
  const numeric = Number(raw ?? '1');

  if (!Number.isFinite(numeric) || numeric < 1) {
    return 1;
  }

  return Math.floor(numeric);
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const rawSearchParams = await searchParams;
  const page = parsePage(rawSearchParams.page);
  const pageSize = 6;
  const data = await getPortalQuotesPageByToken(token, page, pageSize);

  if (!data) return notFound();

  const pagination = getPaginationState({
    totalItems: data.total,
    page,
    pageSize,
  });

  const pageHref = (nextPage: number) => buildSearchHref({}, { page: nextPage });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{data.tenantName}</h1>
        <p className="text-muted-foreground">
          Cotizaciones para {data.leadName}
          {data.leadEmail && ` (${data.leadEmail})`}
        </p>
      </div>

      {data.quotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FileText className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay cotizaciones disponibles</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.quotes.map((quote) => {
            const statusCfg = STATUS_LABEL[quote.status] ?? STATUS_LABEL.ENVIADA;
            const StatusIcon = statusCfg.icon;
            return (
              <Link
                key={quote.id}
                href={`/portal/${token}/quotes/${quote.id}${buildSearchHref(
                  {},
                  {
                    page: pagination.currentPage,
                  },
                )}`}
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{quote.quoteNumber}</CardTitle>
                      <Badge variant={statusCfg.variant}>
                        <StatusIcon className="mr-1 size-3" />
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {new Intl.NumberFormat('es-PE', {
                          style: 'currency',
                          currency: quote.currency,
                          minimumFractionDigits: 2,
                        }).format(quote.totalAmount)}
                      </span>
                      <span>
                        {quote.issuedAt
                          ? new Date(quote.issuedAt).toLocaleDateString('es-PE')
                          : new Date(quote.createdAt).toLocaleDateString('es-PE')}
                      </span>
                    </div>
                    {quote.validUntil && (
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        Válida hasta {new Date(quote.validUntil).toLocaleDateString('es-PE')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          <ListPagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={data.total}
            startItem={pagination.startItem}
            endItem={pagination.endItem}
            hrefForPage={pageHref}
          />
        </div>
      )}
    </div>
  );
}
