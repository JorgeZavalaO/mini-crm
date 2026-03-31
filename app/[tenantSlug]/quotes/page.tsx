import { CheckCircle2, Clock, ScrollText, SendHorizonal, XCircle } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { listTenantQuotesAction } from '@/lib/quote-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuoteDialogTrigger } from '@/components/quotes/quote-dialog-trigger';
import { QuoteList } from '@/components/quotes/quote-list';

export default async function QuotesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { session, membership, tenant } = await requireTenantFeature(tenantSlug, 'QUOTING_BASIC');

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
  };

  const [quotesResult, leads] = await Promise.all([
    listTenantQuotesAction({ tenantSlug, page: 1, pageSize: 100 }).catch(() => ({
      quotes: [],
      total: 0,
    })),
    db.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { businessName: 'asc' },
      take: 200,
      select: { id: true, businessName: true, ruc: true },
    }),
  ]);

  const { quotes, total } = quotesResult;

  const stats = {
    borrador: quotes.filter((q) => q.status === 'BORRADOR').length,
    enviada: quotes.filter((q) => q.status === 'ENVIADA').length,
    aceptada: quotes.filter((q) => q.status === 'ACEPTADA').length,
    rechazada: quotes.filter((q) => q.status === 'RECHAZADA').length,
  };

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
        <CardContent className="p-0 pb-1">
          <QuoteList
            quotes={quotes}
            tenantSlug={tenantSlug}
            currentUserId={actor.userId}
            currentRole={actor.role}
            isSuperAdmin={actor.isSuperAdmin}
            showLeadColumn
          />
        </CardContent>
      </Card>
    </div>
  );
}
