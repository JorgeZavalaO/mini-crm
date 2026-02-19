'use client';

import { useActionState } from 'react';
import { createTenantAction } from '@/lib/superadmin-actions';
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
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useState } from 'react';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function NewTenantPage() {
  const [state, formAction, pending] = useActionState(createTenantAction, undefined);
  const [slug, setSlug] = useState('');

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href="/superadmin">← Volver</Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold">Nueva empresa</h1>
      </div>

      <Card>
        <form action={formAction}>
          <CardHeader>
            <CardTitle>Datos de la empresa</CardTitle>
            <CardDescription>Crea un tenant y su usuario administrador.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre de la empresa</Label>
              <Input
                id="companyName"
                name="companyName"
                placeholder="Acme Logistics"
                required
                onChange={(e) => setSlug(slugify(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="acme-logistics"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">URL: /{slug || 'slug'}/dashboard</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="adminName">Nombre del administrador</Label>
              <Input id="adminName" name="adminName" placeholder="Juan Pérez" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">Email del administrador</Label>
              <Input
                id="adminEmail"
                name="adminEmail"
                type="email"
                placeholder="admin@acme.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPassword">Contraseña</Label>
              <Input
                id="adminPassword"
                name="adminPassword"
                type="password"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? 'Creando…' : 'Crear empresa'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
