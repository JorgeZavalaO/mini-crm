'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/auth-actions';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Iniciar sesion</CardTitle>
        <CardDescription>Ingresa tu empresa, email y contrasena</CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="slug">Empresa</Label>
            <Input
              id="slug"
              name="slug"
              type="text"
              placeholder="mi-empresa"
              required
              autoComplete="organization"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@empresa.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contrasena</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Ingresando...' : 'Ingresar'}
          </Button>

          <p className="text-sm text-muted-foreground">
            El alta de cuentas esta gestionada por el equipo SuperAdmin.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
