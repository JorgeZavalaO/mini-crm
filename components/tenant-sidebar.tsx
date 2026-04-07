'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  Bell,
  Building2,
  ClipboardList,
  Copy,
  FileText,
  LayoutDashboard,
  Package,
  ScrollText,
  Target,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarUserMenu } from '@/components/sidebar-user-menu';

interface TenantSidebarProps {
  tenantSlug: string;
  tenantName: string;
  role: string | null;
  showTeam: boolean;
  canManageDedupe: boolean;
  userName: string | null;
  userEmail: string;
  enabledFeatures: Record<string, boolean>;
}

export function TenantSidebar({
  tenantSlug,
  tenantName,
  role,
  showTeam,
  canManageDedupe,
  userName,
  userEmail,
  enabledFeatures,
}: TenantSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    ...(enabledFeatures.DASHBOARD
      ? [{ href: `/${tenantSlug}/dashboard`, label: 'Tablero', icon: LayoutDashboard }]
      : []),
    ...(enabledFeatures.CRM_LEADS
      ? [{ href: `/${tenantSlug}/leads`, label: 'Leads', icon: Target }]
      : []),
    ...(enabledFeatures.DEDUPE && canManageDedupe
      ? [{ href: `/${tenantSlug}/leads/dedupe`, label: 'Duplicados', icon: Copy }]
      : []),
    ...(enabledFeatures.DOCUMENTS
      ? [{ href: `/${tenantSlug}/documents`, label: 'Documentos', icon: FileText }]
      : []),
    ...(enabledFeatures.QUOTING_BASIC
      ? [{ href: `/${tenantSlug}/quotes`, label: 'Cotizaciones', icon: ScrollText }]
      : []),
    ...(enabledFeatures.QUOTING_BASIC
      ? [{ href: `/${tenantSlug}/products`, label: 'Catálogo', icon: Package }]
      : []),
    ...(enabledFeatures.TASKS
      ? [{ href: `/${tenantSlug}/tasks`, label: 'Tareas', icon: ClipboardList }]
      : []),
    ...(enabledFeatures.NOTIFICATIONS
      ? [{ href: `/${tenantSlug}/notifications`, label: 'Notificaciones', icon: Bell }]
      : []),
    ...(showTeam ? [{ href: `/${tenantSlug}/team`, label: 'Equipo', icon: Users }] : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={`/${tenantSlug}/dashboard`}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Mini CRM</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">{tenantName}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarUserMenu
              userName={userName}
              userEmail={userEmail}
              profileHref={`/${tenantSlug}/profile`}
              profileLabel="Mi cuenta"
              badgeLabel={role}
              avatarFallbackClassName="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground"
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
