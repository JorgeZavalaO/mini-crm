import { requireTenantAccess } from '@/lib/auth-guard';
import { TenantProvider } from '@/lib/tenant-context';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SignOutButton } from './sign-out-button';
import { hasRole } from '@/lib/rbac';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await requireTenantAccess(tenantSlug);

  const role = membership?.role ?? (session.user.isSuperAdmin ? 'SUPERADMIN' : null);
  const showTeam = session.user.isSuperAdmin || hasRole(role, 'SUPERVISOR');

  return (
    <TenantProvider
      tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
      role={membership?.role ?? null}
      isSuperAdmin={session.user.isSuperAdmin}
    >
      <div className="min-h-screen bg-background">
        {/* ── Header ─────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <Link href={`/${tenantSlug}/dashboard`} className="text-lg font-bold">
                Mini CRM
              </Link>

              <nav className="hidden items-center gap-1 md:flex">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/${tenantSlug}/dashboard`}>Dashboard</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/${tenantSlug}/leads`}>Leads</Link>
                </Button>
                {showTeam && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/${tenantSlug}/team`}>Equipo</Link>
                  </Button>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {tenant.name}
              </Badge>
              {role && (
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {role}
                </Badge>
              )}

              {session.user.isSuperAdmin && (
                <Button variant="ghost" size="sm" className="text-red-500" asChild>
                  <a href="/superadmin" target="_blank" rel="noopener noreferrer">
                    ⚙ Admin
                  </a>
                </Button>
              )}

              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${tenantSlug}/profile`}>
                  {session.user.name ?? session.user.email}
                </Link>
              </Button>

              <SignOutButton />
            </div>
          </div>
        </header>

        {/* ── Main content ───────────────────────────── */}
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </div>
    </TenantProvider>
  );
}
