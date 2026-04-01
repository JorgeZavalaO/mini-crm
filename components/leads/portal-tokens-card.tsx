'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Check, Copy, Globe, Loader2, XCircle } from 'lucide-react';
import { createPortalTokenAction, revokePortalTokenAction } from '@/lib/portal-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PortalToken = {
  id: string;
  token: string;
  isActive: boolean;
  expiresAt: Date | null;
  lastAccessedAt: Date | null;
  createdAt: Date;
  createdBy: { name: string | null; email: string };
};

type Props = {
  tenantSlug: string;
  leadId: string;
  tokens: PortalToken[];
  counts?: {
    active: number;
    inactive: number;
  };
};

export function PortalTokensCard({ tenantSlug, leadId, tokens: initialTokens, counts }: Props) {
  const [tokens, setTokens] = useState(initialTokens);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState({
    active: counts?.active ?? initialTokens.filter((token) => token.isActive).length,
    inactive: counts?.inactive ?? initialTokens.filter((token) => !token.isActive).length,
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  useEffect(() => {
    setSummary({
      active: counts?.active ?? initialTokens.filter((token) => token.isActive).length,
      inactive: counts?.inactive ?? initialTokens.filter((token) => !token.isActive).length,
    });
  }, [counts?.active, counts?.inactive, initialTokens]);

  const handleCreate = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await createPortalTokenAction({ tenantSlug, leadId });
        if (result.success && result.token) {
          setNewToken(result.token);
          // Refresh list
          setTokens((prev) => [
            {
              id: result.tokenId,
              token: result.token,
              isActive: true,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              lastAccessedAt: null,
              createdAt: new Date(),
              createdBy: { name: null, email: '' },
            },
            ...prev,
          ]);
          setSummary((prev) => ({ ...prev, active: prev.active + 1 }));
        }
      } catch {
        /* ignore */
      }
    });
  }, [tenantSlug, leadId]);

  const handleRevoke = useCallback(
    (tokenId: string) => {
      startTransition(async () => {
        try {
          await revokePortalTokenAction({ tenantSlug, tokenId });
          setTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, isActive: false } : t)));
          setSummary((prev) => ({
            active: Math.max(0, prev.active - 1),
            inactive: prev.inactive + 1,
          }));
        } catch {
          /* ignore */
        }
      });
    },
    [tenantSlug],
  );

  const handleCopy = useCallback((token: string) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const activeTokens = tokens.filter((t) => t.isActive);
  const inactiveTokens = tokens.filter((t) => !t.isActive);
  const activeCount = summary.active;
  const inactiveCount = summary.inactive;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div>
          <CardTitle>Portal de cliente</CardTitle>
          <CardDescription>
            Genera enlaces seguros para que el cliente vea sus cotizaciones.
          </CardDescription>
        </div>
        <Button size="sm" onClick={handleCreate} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Globe className="mr-1.5 size-4" />
          )}
          Generar enlace
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token recién creado */}
        {newToken && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
            <p className="mb-2 text-sm font-medium text-primary">Enlace generado:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/portal/${newToken}`
                  : `/portal/${newToken}`}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => handleCopy(newToken)}
              >
                {copied ? (
                  <Check className="size-3.5 text-green-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Comparte este enlace con el cliente. Expira en 30 días.
            </p>
          </div>
        )}

        {/* Lista de tokens activos */}
        {activeTokens.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Enlaces activos ({activeCount})
            </p>
            <ul className="divide-y rounded-md border">
              {activeTokens.map((t) => {
                const isExpired = t.expiresAt && new Date(t.expiresAt) < new Date();
                return (
                  <li key={t.id} className="flex items-center justify-between px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="truncate text-xs text-muted-foreground">
                          ...{t.token.slice(-8)}
                        </code>
                        <Badge
                          variant={isExpired ? 'destructive' : 'default'}
                          className="text-[10px]"
                        >
                          {isExpired ? 'Expirado' : 'Activo'}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>Creado {new Date(t.createdAt).toLocaleDateString('es-PE')}</span>
                        {t.expiresAt && (
                          <>
                            <span>·</span>
                            <span>Expira {new Date(t.expiresAt).toLocaleDateString('es-PE')}</span>
                          </>
                        )}
                        {t.lastAccessedAt && (
                          <>
                            <span>·</span>
                            <span>
                              Visto {new Date(t.lastAccessedAt).toLocaleDateString('es-PE')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleCopy(t.token)}
                        title="Copiar enlace"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(t.id)}
                        disabled={isPending}
                        title="Revocar"
                      >
                        <XCircle className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Tokens inactivos */}
        {inactiveTokens.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Revocados ({inactiveCount})
            </p>
            <ul className="divide-y rounded-md border opacity-60">
              {inactiveTokens.map((t) => (
                <li key={t.id} className="flex items-center px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="truncate text-xs text-muted-foreground">
                        ...{t.token.slice(-8)}
                      </code>
                      <Badge variant="secondary" className="text-[10px]">
                        Revocado
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Creado {new Date(t.createdAt).toLocaleDateString('es-PE')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tokens.length === 0 && !newToken && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Globe className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No se han generado enlaces de portal para este lead.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
