import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SuperadminPage() {
  const [tenantCount, userCount, leadCount] = await Promise.all([
    db.tenant.count(),
    db.user.count(),
    db.lead.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Panel Super Admin</h1>
      <p className="text-zinc-400">Gestión global de la plataforma multi-tenant.</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-50">{tenantCount}</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-50">{userCount}</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Leads (global)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-50">{leadCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
