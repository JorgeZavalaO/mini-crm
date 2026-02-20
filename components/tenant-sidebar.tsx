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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building2, FileText, LayoutDashboard, LogOut, Target, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface TenantSidebarProps {
  tenantSlug: string;
  tenantName: string;
  role: string | null;
  showTeam: boolean;
  userName: string | null;
  userEmail: string;
  enabledFeatures: Record<string, boolean>;
}

export function TenantSidebar({
  tenantSlug,
  tenantName,
  role,
  showTeam,
  userName,
  userEmail,
  enabledFeatures,
}: TenantSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    ...(enabledFeatures.DASHBOARD
      ? [{ href: `/${tenantSlug}/dashboard`, label: 'Dashboard', icon: LayoutDashboard }]
      : []),
    ...(enabledFeatures.CRM_LEADS
      ? [{ href: `/${tenantSlug}/leads`, label: 'Leads', icon: Target }]
      : []),
    ...(enabledFeatures.DOCUMENTS
      ? [{ href: `/${tenantSlug}/documents`, label: 'Documentos', icon: FileText }]
      : []),
    ...(showTeam ? [{ href: `/${tenantSlug}/team`, label: 'Equipo', icon: Users }] : []),
    { href: `/${tenantSlug}/profile`, label: 'Mi cuenta', icon: User },
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
            <SidebarMenuButton
              size="lg"
              className="cursor-default hover:bg-transparent active:bg-transparent"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                  {(userName ?? userEmail)
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{userName ?? userEmail}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">{userEmail}</span>
              </div>
              {role && (
                <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                  {role}
                </Badge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => signOut({ callbackUrl: '/login' })}
              tooltip="Cerrar sesion"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut />
              <span>Cerrar sesion</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
