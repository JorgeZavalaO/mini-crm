import type { Prisma } from '@prisma/client';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  ScrollText,
  SendHorizonal,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { buildSearchHref, firstSearchParam, getPaginationState } from '@/lib/pagination';
import { listTenantQuotesAction } from '@/lib/quote-actions';
import { quoteFiltersSchema } from '@/lib/validators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListPagination } from '@/components/ui/list-pagination';
import type { ProductOption } from '@/components/quotes/product-selector';
import { QuoteDialogTrigger } from '@/components/quotes/quote-dialog-trigger';
import { QuoteList } from '@/components/quotes/quote-list';

function fmtAmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

export default async function QuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const [{ session, membership, tenant }, rawSearchParams] = await Promise.all([
    requireTenantFeature(tenantSlug, 'QUOTING_BASIC'),
    searchParams,
  ]);

  const parsedFilters = quoteFiltersSchema.safeParse({
    tenantSlug,
    leadId: firstSearchParam(rawSearchParams.leadId),
    q: firstSearchParam(rawSearchParams.q),
    status: firstSearchParam(rawSearchParams.status),
    page: firstSearchParam(rawSearchParams.page) ?? '1',
    pageSize: firstSearchParam(rawSearchParams.pageSize) ?? '20',
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : quoteFiltersSchema.parse({ tenantSlug, page: 1, pageSize: 20 });

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
  };

  const statsWhere: Prisma.QuoteWhereInput = {
    tenantId: tenant.id,
    deletedAt: null,
    leadId: filters.leadId ?? undefined,
    OR: filters.q
      ? [
          { quoteNumber: { contains: filters.q, mode: 'insensitive' } },
          { lead: { businessName: { contains: filters.q, mode: 'insensitive' } } },
        ]
      : undefined,
  };

  const [quotesResult, leads, statusRows, rawProducts] = await Promise.all([
    listTenantQuotesAction(filters).catch(() => ({
      quotes: [],
      total: 0,
    })),
    db.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { businessName: 'asc' },
      take: 200,
      select: { id: true, businessName: true, ruc: true },
    }),
    db.quote.groupBy({
      by: ['status'],
      where: statsWhere,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    db.product.findMany({
      where: { tenantId: tenant.id, deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      take: 200,
      select: { id: true, name: true, description: true, unitPrice: true, currency: true },
    }),
  ]);

  const { quotes, total } = quotesResult;
  const pagination = getPaginationState({
    totalItems: total,
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const products: ProductOption[] = rawProducts.map((p) => ({
    ...p,
    unitPrice: Number(p.unitPrice),
    currency: p.currency as 'PEN' | 'USD',
  }));

  const countByStatus: Record<string, number> = {};
  const amountByStatus: Record<string, number> = {};
  for (const row of statusRows) {
    countByStatus[row.status] = row._count._all;
    amountByStatus[row.status] = Number(row._sum.totalAmount ?? 0);
  }

  const stats = {
    borrador: { count: countByStatus.BORRADOR ?? 0, amount: amountByStatus.BORRADOR ?? 0 },
    enviada: { count: countByStatus.ENVIADA ?? 0, amount: amountByStatus.ENVIADA ?? 0 },
    aceptada: { count: countByStatus.ACEPTADA ?? 0, amount: amountByStatus.ACEPTADA ?? 0 },
    rechazada: { count: countByStatus.RECHAZADA ?? 0, amount: amountByStatus.RECHAZADA ?? 0 },
  };

  const pipeline = stats.borrador.count + stats.enviada.count;
  const pipelineAmount = stats.borrador.amount + stats.enviada.amount;
  const closed = stats.aceptada.count + stats.rechazada.count;
  const closingRate = closed > 0 ? Math.round((stats.aceptada.count / closed) * 100) : 0;

  const pageHref = (page: number) =>
    buildSearchHref(
      {
        leadId: filters.leadId,
        q: filters.q,
        status: filters.status,
        pageSize: filters.pageSize,
      },
      { page },
    );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <ScrollText className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cotizaciones</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus propuestas comerciales y su ciclo de vida.
            </p>
          </div>
        </div>
        <QuoteDialogTrigger tenantSlug={tenantSlug} leads={leads} products={products} />
      </div>

      {/* KPI — Tarjetas de estado */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Borradores
                </p>
                <p className="mt-1 text-3xl font-bold">{stats.borrador.count}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {fmtAmt(stats.borrador.amount)} en cartera
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-muted p-2">
                <Clock className="size-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Enviadas
                </p>
                <p className="mt-1 text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.enviada.count}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {fmtAmt(stats.enviada.amount)} en cartera
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-blue-500/10 p-2">
                <SendHorizonal className="size-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Aceptadas
                </p>
                <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.aceptada.count}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {fmtAmt(stats.aceptada.amount)} cerrado
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-emerald-500/10 p-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rechazadas
                </p>
                <p className="mt-1 text-3xl font-bold text-red-600 dark:text-red-400">
                  {stats.rechazada.count}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {fmtAmt(stats.rechazada.amount)} perdido
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-red-500/10 p-2">
                <XCircle className="size-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI — Métricas derivadas */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pipeline activo
                </p>
                <p className="mt-1 text-3xl font-bold">{pipeline}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {fmtAmt(pipelineAmount)} en negociación
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-primary/10 p-2">
                <TrendingUp className="size-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tasa de cierre
                </p>
                <p className="mt-1 text-3xl font-bold">{closingRate}%</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stats.aceptada.count} de {closed} cotizaciones cerradas
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-emerald-500/10 p-2">
                <BarChart3 className="size-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla principal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {total} cotización{total === 1 ? '' : 'es'} registrada{total === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0 pb-4">
          <QuoteList
            quotes={quotes}
            tenantSlug={tenantSlug}
            currentUserId={actor.userId}
            currentRole={actor.role}
            isSuperAdmin={actor.isSuperAdmin}
            showLeadColumn
          />

          <div className="px-6">
            <ListPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={total}
              startItem={pagination.startItem}
              endItem={pagination.endItem}
              hrefForPage={pageHref}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
