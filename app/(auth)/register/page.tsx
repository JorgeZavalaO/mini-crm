'use client';

import { useActionState } from 'react';
import { registerAction } from '@/lib/auth-actions';
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
import Link from 'next/link';

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Crear cuenta</CardTitle>
        <CardDescription>Registra tu empresa y empieza a gestionar tus leads</CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" placeholder="Tu nombre" required autoComplete="name" />
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
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Nombre de tu empresa</Label>
            <Input id="companyName" name="companyName" placeholder="Acme Corp" required />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creando cuenta…' : 'Registrarse'}
          </Button>

          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-primary underline">
              Inicia sesión
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
