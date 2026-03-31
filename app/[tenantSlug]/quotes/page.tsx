import { ScrollText } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { listTenantQuotesAction } from '@/lib/quote-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QuoteCreateForm } from '@/components/quotes/quote-create-form';
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
    listTenantQuotesAction({ tenantSlug, page: 1, pageSize: 50 }).catch(() => ({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScrollText className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Crea cotizaciones comerciales, cambia estado y da seguimiento por lead.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva cotización</CardTitle>
          <CardDescription>Incluye items, moneda e impuesto.</CardDescription>
        </CardHeader>
        <CardContent>
          <QuoteCreateForm tenantSlug={tenantSlug} leads={leads} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
          <CardDescription>
            {quotesResult.total} cotización{quotesResult.total === 1 ? '' : 'es'} registrada
            {quotesResult.total === 1 ? '' : 's'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <QuoteList
            quotes={quotesResult.quotes}
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
