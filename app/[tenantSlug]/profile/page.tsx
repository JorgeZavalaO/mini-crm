import { requireTenantAccess } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default async function ProfilePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { session } = await requireTenantAccess(tenantSlug);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        include: { tenant: { select: { name: true, slug: true } } },
        where: { isActive: true },
      },
    },
  });

  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mi cuenta</h1>

      <Card>
        <CardHeader>
          <CardTitle>{user.name ?? 'Sin nombre'}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tipo de cuenta:</span>
            {user.isSuperAdmin ? (
              <Badge variant="destructive">Super Admin</Badge>
            ) : (
              <Badge variant="secondary">Usuario</Badge>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 font-semibold">Membresías</h3>
            {user.memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No perteneces a ninguna organización todavía.
              </p>
            ) : (
              <ul className="space-y-2">
                {user.memberships.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{m.tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{m.tenant.slug}</p>
                    </div>
                    <Badge variant={m.tenant.slug === tenantSlug ? 'default' : 'outline'}>
                      {m.role}
                      {m.tenant.slug === tenantSlug && ' (activo)'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
