import { auth } from '@/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // If user has a tenantSlug in their token, go there
  if (session.user.tenantSlug) {
    redirect(`/${session.user.tenantSlug}/dashboard`);
  }

  // SuperAdmin without tenant membership
  if (session.user.isSuperAdmin) {
    redirect('/superadmin');
  }

  // Fallback: find first active membership
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, isActive: true, tenant: { isActive: true } },
    include: { tenant: { select: { slug: true } } },
  });

  if (membership) {
    redirect(`/${membership.tenant.slug}/dashboard`);
  }

  // No membership at all
  redirect('/login');
}
