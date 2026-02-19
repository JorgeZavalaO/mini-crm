import { auth } from '@/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const session = await auth();
  const tenantId = session?.user?.tenantId;

  let stats = { leads: 0, members: 0 };

  if (tenantId) {
    const [leads, members] = await Promise.all([
      db.lead.count({ where: { tenantId } }),
      db.membership.count({ where: { tenantId } }),
    ]);
    stats = { leads, members };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.leads}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Miembros del equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.members}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tu rol</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{session?.user?.role ?? '—'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
