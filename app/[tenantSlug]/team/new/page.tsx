'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { createMemberAction } from '@/lib/team-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useTenant } from '@/lib/tenant-context';

export default function NewMemberPage() {
  const { tenant } = useTenant();
  const [state, formAction, pending] = useActionState(createMemberAction, undefined);
  const [role, setRole] = useState('VENDEDOR');

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href={`/${tenant.slug}/team`}>← Volver al equipo</Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold">Nuevo miembro</h1>
      </div>

      <Card>
        <form action={formAction}>
          <input type="hidden" name="tenantId" value={tenant.id} />
          <input type="hidden" name="tenantSlug" value={tenant.slug} />
          <input type="hidden" name="role" value={role} />

          <CardHeader>
            <CardTitle>Agregar miembro a {tenant.name}</CardTitle>
            <CardDescription>
              Si el email ya existe en el sistema, se creará una membresía nueva.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" placeholder="Juan Pérez" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="juan@empresa.com" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                  <SelectItem value="FREELANCE">Freelance</SelectItem>
                  <SelectItem value="PASANTE">Pasante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Creando…' : 'Crear miembro'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
