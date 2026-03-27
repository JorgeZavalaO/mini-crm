import { requireTenantRole } from '@/lib/auth-guard';
import { NewMemberForm } from './new-member-form';

export default async function NewMemberPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantRole(tenantSlug, 'ADMIN');

  return <NewMemberForm tenant={tenant} />;
}
