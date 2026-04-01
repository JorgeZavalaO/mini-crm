import type { Prisma } from '@prisma/client';
import { CheckCircle2, Clock, ScrollText, SendHorizonal, XCircle } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { buildSearchHref, firstSearchParam, getPaginationState } from '@/lib/pagination';
import { listTenantQuotesAction } from '@/lib/quote-actions';
import { quoteFiltersSchema } from '@/lib/validators';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListPagination } from '@/components/ui/list-pagination';
import { QuoteDialogTrigger } from '@/components/quotes/quote-dialog-trigger';
import { QuoteList } from '@/components/quotes/quote-list';

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

  const [quotesResult, leads, statusRows] = await Promise.all([
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
    }),
  ]);

  const { quotes, total } = quotesResult;
  const pagination = getPaginationState({
    totalItems: total,
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const countByStatus = statusRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const stats = {
    borrador: countByStatus.BORRADOR ?? 0,
    enviada: countByStatus.ENVIADA ?? 0,
    aceptada: countByStatus.ACEPTADA ?? 0,
    rechazada: countByStatus.RECHAZADA ?? 0,
  };

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
        <QuoteDialogTrigger tenantSlug={tenantSlug} leads={leads} />
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-muted-foreground/30">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Borrador
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold">{stats.borrador}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Enviadas
            </CardTitle>
            <SendHorizonal className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.enviada}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Aceptadas
            </CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.aceptada}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rechazadas
            </CardTitle>
            <XCircle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.rechazada}</p>
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
