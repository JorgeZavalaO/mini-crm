import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-guard';
import { ThemePreferencesCard } from '@/components/theme-preferences-card';

export default async function SuperadminProfilePage() {
  const session = await requireSuperAdmin();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        include: { tenant: { select: { name: true, slug: true, isActive: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user) redirect('/login');

  const activeMemberships = user.memberships.filter((membership) => membership.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Mi perfil</h1>
          <p className="text-muted-foreground">
            Datos de acceso del Super Admin y visibilidad de sus empresas vinculadas.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/superadmin">Volver al panel</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{user.name ?? 'Sin nombre'}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive">Super Admin</Badge>
              <Badge variant="outline">
                {activeMemberships.length} membresía{activeMemberships.length === 1 ? '' : 's'}{' '}
                activa
                {activeMemberships.length === 1 ? '' : 's'}
              </Badge>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">ID de usuario</p>
                <p className="mt-1 break-all text-sm font-medium">{user.id}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Empresas activas</p>
                <p className="mt-1 text-2xl font-bold">{activeMemberships.length}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Acceso global</p>
                <p className="mt-1 text-2xl font-bold">Sí</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accesos rápidos</CardTitle>
            <CardDescription>Atajos del panel administrativo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="outline" asChild>
              <Link href="/superadmin/plans">Gestionar planes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin">Gestionar empresas</Link>
            </Button>
            <Button asChild>
              <Link href="/superadmin">Ver dashboard</Link>
            </Button>
          </CardContent>
        </Card>

        <ThemePreferencesCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresas vinculadas</CardTitle>
          <CardDescription>
            Membresías registradas para tu usuario, útiles para impersonación o soporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay memberships vinculadas a este usuario todavía.
            </p>
          ) : (
            <div className="space-y-3">
              {user.memberships.map((membership) => (
                <div
                  key={membership.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{membership.tenant.name}</p>
                    <p className="text-sm text-muted-foreground">/{membership.tenant.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{membership.role}</Badge>
                    <Badge variant={membership.isActive ? 'default' : 'secondary'}>
                      {membership.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                    <Badge variant={membership.tenant.isActive ? 'default' : 'outline'}>
                      {membership.tenant.isActive ? 'Tenant activo' : 'Tenant inactivo'}
                    </Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${membership.tenant.slug}/dashboard`}>Abrir tenant</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
