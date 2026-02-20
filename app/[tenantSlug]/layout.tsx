import { requireTenantAccess } from '@/lib/auth-guard';
import { getTenantFeatureMap } from '@/lib/feature-service';
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
  const enabledFeatures = await getTenantFeatureMap(tenant.id);

  const role = membership?.role ?? (session.user.isSuperAdmin ? 'SUPERADMIN' : null);
  const showTeam = session.user.isSuperAdmin || hasRole(role, 'SUPERVISOR');

  return (
    <TenantProvider
      tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
      role={membership?.role ?? null}
      isSuperAdmin={session.user.isSuperAdmin}
    >
      <SidebarProvider defaultOpen={true}>
        <TenantSidebar
          tenantSlug={tenantSlug}
          tenantName={tenant.name}
          role={role}
          showTeam={showTeam}
          userName={session.user.name ?? null}
          userEmail={session.user.email ?? ''}
          enabledFeatures={enabledFeatures}
        />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="text-sm font-medium text-muted-foreground">{tenant.name}</span>
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TenantProvider>
  );
}
