'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-zinc-400 hover:text-zinc-50"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Salir
    </Button>
  );
}
