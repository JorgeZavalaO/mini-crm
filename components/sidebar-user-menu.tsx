'use client';

import Link from 'next/link';
import { LogOut, UserCircle2 } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';

interface SidebarUserMenuProps {
  userName: string | null;
  userEmail: string;
  profileHref: string;
  profileLabel?: string;
  badgeLabel?: string | null;
  avatarFallbackClassName: string;
}

export function SidebarUserMenu({
  userName,
  userEmail,
  profileHref,
  profileLabel = 'Mi perfil',
  badgeLabel,
  avatarFallbackClassName,
}: SidebarUserMenuProps) {
  const initials = (userName ?? userEmail)
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" tooltip="Cuenta y sesión">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className={avatarFallbackClassName}>{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{userName ?? userEmail}</span>
            <span className="truncate text-xs text-sidebar-foreground/70">{userEmail}</span>
          </div>
          {badgeLabel ? (
            <Badge variant="outline" className="ml-auto shrink-0 text-xs">
              {badgeLabel}
            </Badge>
          ) : null}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <div className="truncate font-semibold">{userName ?? userEmail}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{userEmail}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserCircle2 />
            <span>{profileLabel}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut({ callbackUrl: '/login' });
          }}
        >
          <LogOut />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
