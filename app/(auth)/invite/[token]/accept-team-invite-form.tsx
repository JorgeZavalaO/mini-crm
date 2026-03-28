'use client';

import { useActionState } from 'react';
import { acceptTeamInvitationAction } from '@/lib/team-invite-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AcceptTeamInviteForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(acceptTeamInvitationAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email invitado</Label>
        <Input id="email" value={email} readOnly disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nombre completo</Label>
        <Input
          id="name"
          name="name"
          placeholder="Tu nombre"
          required
          minLength={2}
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Crea una contraseña o usa la actual"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Repite tu contraseña"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Si ya tienes una cuenta con este email en la plataforma, usa tu contraseña actual para
        aceptar la invitación y entrar al tenant.
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Activando acceso…' : 'Aceptar invitación e ingresar'}
      </Button>
    </form>
  );
}
