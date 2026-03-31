'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { deleteQuoteAction, changeQuoteStatusAction, type QuoteRow } from '@/lib/quote-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

function formatDate(value: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

const STATUS_LABEL: Record<QuoteRow['status'], string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
};

function statusVariant(
  status: QuoteRow['status'],
): 'outline' | 'secondary' | 'default' | 'destructive' {
  if (status === 'ACEPTADA') return 'default';
  if (status === 'RECHAZADA') return 'destructive';
  if (status === 'ENVIADA') return 'secondary';
  return 'outline';
}

type Props = {
  quotes: QuoteRow[];
  tenantSlug: string;
  currentUserId: string;
  currentRole: string | null;
  isSuperAdmin: boolean;
  showLeadColumn?: boolean;
};

export function QuoteList({
  quotes,
  tenantSlug,
  currentUserId,
  currentRole,
  isSuperAdmin,
  showLeadColumn = true,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function canModerate() {
    if (isSuperAdmin) return true;
    return currentRole === 'ADMIN' || currentRole === 'SUPERVISOR' || currentRole === 'VENDEDOR';
  }

  function canDelete(quote: QuoteRow) {
    if (isSuperAdmin) return true;
    if (quote.status !== 'BORRADOR') return currentRole === 'ADMIN' || currentRole === 'SUPERVISOR';
    if (quote.createdById === currentUserId) return true;
    return currentRole === 'ADMIN' || currentRole === 'SUPERVISOR';
  }

  function nextStatuses(status: QuoteRow['status']) {
    if (status === 'BORRADOR') return ['ENVIADA', 'RECHAZADA'] as const;
    if (status === 'ENVIADA') return ['ACEPTADA', 'RECHAZADA'] as const;
    return [] as const;
  }

  function handleStatus(quoteId: string, status: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA') {
    setBusyId(quoteId);
    setError(null);
    startTransition(async () => {
      try {
        await changeQuoteStatusAction({ tenantSlug, quoteId, status });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleDelete(quoteId: string) {
    setBusyId(quoteId);
    setError(null);
    startTransition(async () => {
      try {
        await deleteQuoteAction({ tenantSlug, quoteId });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo eliminar la cotización');
      } finally {
        setBusyId(null);
      }
    });
  }

  if (quotes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        No hay cotizaciones todavía.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              {showLeadColumn && <TableHead>Lead</TableHead>}
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Subtotal</TableHead>
              <TableHead className="hidden md:table-cell">Impuesto</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="hidden lg:table-cell">Validez</TableHead>
              <TableHead className="w-56">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const loading = busyId === quote.id && isPending;
              return (
                <TableRow key={quote.id} className={loading ? 'opacity-60' : ''}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/${tenantSlug}/quotes/${quote.id}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {quote.quoteNumber}
                      <ExternalLink className="size-3" />
                    </Link>
                  </TableCell>
                  {showLeadColumn && (
                    <TableCell className="max-w-44 truncate">{quote.leadName}</TableCell>
                  )}
                  <TableCell>
                    <Badge variant={statusVariant(quote.status)}>
                      {STATUS_LABEL[quote.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatMoney(quote.subtotal, quote.currency)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatMoney(quote.taxAmount, quote.currency)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatMoney(quote.totalAmount, quote.currency)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDate(quote.validUntil)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {canModerate() &&
                        nextStatuses(quote.status).map((next) => (
                          <Button
                            key={next}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => handleStatus(quote.id, next)}
                          >
                            {loading ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              STATUS_LABEL[next]
                            )}
                          </Button>
                        ))}
                      {canDelete(quote) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={loading}
                          onClick={() => handleDelete(quote.id)}
                        >
                          {loading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
