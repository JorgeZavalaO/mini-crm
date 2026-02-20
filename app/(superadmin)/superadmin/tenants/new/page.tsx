import Link from 'next/link';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TenantCreateForm } from '@/components/superadmin/tenant-create-form';

export default async function NewTenantPage() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      maxUsers: true,
      maxStorageGb: true,
      retentionDays: true,
      isActive: true,
    },
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href="/superadmin">Volver</Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold">Nueva empresa</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alta de tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <TenantCreateForm plans={plans} />
        </CardContent>
      </Card>
    </div>
  );
}
