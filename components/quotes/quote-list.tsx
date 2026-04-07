'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  CheckCircle2,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  SendHorizonal,
  ThumbsDown,
  Trash2,
} from 'lucide-react';
import { QuotePdfButton } from './quote-pdf-button';
import { changeQuoteStatusAction, deleteQuoteAction, type QuoteRow } from '@/lib/quote-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const STATUS_CLASS: Record<QuoteRow['status'], string> = {
  BORRADOR: 'bg-muted text-muted-foreground border border-border',
  ENVIADA:
    'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  ACEPTADA:
    'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  RECHAZADA:
    'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
};

const NEXT_STATUS_ICON = {
  ENVIADA: <SendHorizonal className="size-3.5" />,
  ACEPTADA: <CheckCircle2 className="size-3.5" />,
  RECHAZADA: <ThumbsDown className="size-3.5" />,
} as const;

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
  const router = useRouter();

  function canModerate() {
    if (isSuperAdmin) return true;
    return currentRole === 'ADMIN' || currentRole === 'SUPERVISOR' || currentRole === 'VENDEDOR';
  }

  function canEdit(quote: QuoteRow) {
    if (isSuperAdmin) return true;
    if (quote.status === 'ACEPTADA' || quote.status === 'RECHAZADA') return false;
    if (quote.status === 'ENVIADA') return currentRole === 'ADMIN' || currentRole === 'SUPERVISOR';
    // BORRADOR: propio dueño o SUPERVISOR+
    if (quote.createdById === currentUserId) return true;
    return currentRole === 'ADMIN' || currentRole === 'SUPERVISOR';
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
        router.refresh();
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
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo eliminar la cotización');
      } finally {
        setBusyId(null);
      }
    });
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-center">
        <p className="text-sm font-medium text-muted-foreground">Sin cotizaciones</p>
        <p className="text-xs text-muted-foreground/70">
          Usa el botón &ldquo;Nueva cotización&rdquo; para crear la primera.
        </p>
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
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-36">Código</TableHead>
              {showLeadColumn && <TableHead>Cliente</TableHead>}
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Subtotal</TableHead>
              <TableHead className="hidden md:table-cell text-right">Impuesto</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden lg:table-cell">Validez</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const loading = busyId === quote.id && isPending;
              const nexts = nextStatuses(quote.status);
              return (
                <TableRow
                  key={quote.id}
                  className={loading ? 'opacity-50 pointer-events-none' : 'group'}
                >
                  <TableCell>
                    <Link
                      href={`/${tenantSlug}/quotes/${quote.id}`}
                      className="font-mono text-xs font-medium text-primary hover:underline"
                    >
                      {quote.quoteNumber}
                    </Link>
                  </TableCell>

                  {showLeadColumn && (
                    <TableCell className="max-w-44">
                      <span className="block truncate text-sm">{quote.leadName}</span>
                    </TableCell>
                  )}

                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[quote.status]}`}
                    >
                      {STATUS_LABEL[quote.status]}
                    </span>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                    {formatMoney(quote.subtotal, quote.currency)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                    {formatMoney(quote.taxAmount, quote.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatMoney(quote.totalAmount, quote.currency)}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {formatDate(quote.validUntil)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {formatDate(quote.createdAt)}
                  </TableCell>

                  <TableCell className="text-right">
                    {loading ? (
                      <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label="Acciones de cotización"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/${tenantSlug}/quotes/${quote.id}`}>
                              <Eye className="mr-2 size-3.5" />
                              Ver detalle
                            </Link>
                          </DropdownMenuItem>

                          {canEdit(quote) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/${tenantSlug}/quotes/${quote.id}`}>
                                  <Pencil className="mr-2 size-3.5" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <QuotePdfButton
                              quoteId={quote.id}
                              tenantSlug={tenantSlug}
                              quoteNumber={quote.quoteNumber}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start gap-2 px-2 py-1.5 font-normal text-sm h-auto"
                            />
                          </DropdownMenuItem>

                          {canModerate() && nexts.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {nexts.map((next) => (
                                <DropdownMenuItem
                                  key={next}
                                  onClick={() => handleStatus(quote.id, next)}
                                >
                                  {NEXT_STATUS_ICON[next]}
                                  <span className="ml-2">Marcar {STATUS_LABEL[next]}</span>
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}

                          {canDelete(quote) && (
                            <>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2 className="mr-2 size-3.5" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar cotización?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará <strong>{quote.quoteNumber}</strong>. Esta acción
                                      no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDelete(quote.id)}
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
