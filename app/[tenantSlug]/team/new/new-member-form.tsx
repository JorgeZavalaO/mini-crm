'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createTeamInvitationAction } from '@/lib/team-invite-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InviteLinkButton } from '../invite-link-button';

type TenantSummary = {
  id: string;
  name: string;
  slug: string;
};

export function NewMemberForm({ tenant }: { tenant: TenantSummary }) {
  const [state, formAction, pending] = useActionState(createTeamInvitationAction, undefined);
  const [role, setRole] = useState('VENDEDOR');

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href={`/${tenant.slug}/team`}>← Volver al equipo</Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold">Invitar miembro</h1>
      </div>

      <Card>
        <form action={formAction}>
          <input type="hidden" name="tenantId" value={tenant.id} />
          <input type="hidden" name="tenantSlug" value={tenant.slug} />
          <input type="hidden" name="role" value={role} />

          <CardHeader>
            <CardTitle>Invitar miembro a {tenant.name}</CardTitle>
            <CardDescription>
              Genera un enlace seguro de onboarding. Si el usuario ya existe, podrá aceptar con su
              contraseña actual.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            {state?.success && state.invitePath && (
              <Alert>
                <AlertDescription className="space-y-3">
                  <p>
                    Invitación creada para <strong>{state.inviteEmail}</strong>. Vence el{' '}
                    <strong>{state.expiresAtLabel}</strong>.
                  </p>
                  <InviteLinkButton
                    invitePath={state.invitePath}
                    label="Copiar enlace de onboarding"
                  />
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" name="email" type="email" placeholder="juan@empresa.com" required />
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                  <SelectItem value="FREELANCE">Freelance</SelectItem>
                  <SelectItem value="PASANTE">Pasante</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">
              Las invitaciones activas reservan cupo dentro del límite del plan hasta que sean
              aceptadas o expiren.
            </p>
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Generando…' : 'Generar invitación'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
