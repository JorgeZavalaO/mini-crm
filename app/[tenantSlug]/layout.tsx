import { requireTenantAccess } from '@/lib/auth-guard';
import { TenantProvider } from '@/lib/tenant-context';
import { hasRole } from '@/lib/rbac';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { TenantSidebar } from '@/components/tenant-sidebar';

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
      <SidebarProvider>
        <TenantSidebar
          tenantSlug={tenantSlug}
          tenantName={tenant.name}
          role={role}
          showTeam={showTeam}
          userName={session.user.name ?? null}
          userEmail={session.user.email ?? ''}
        />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="text-sm font-medium text-muted-foreground">{tenant.name}</span>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TenantProvider>
  );
}
