import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { SignOutButton } from './sign-out-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Fetch tenant info if available
  let tenantName: string | null = null;
  if (session.user.tenantId) {
    const tenant = await db.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { name: true },
    });
    tenantName = tenant?.name ?? null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-lg font-bold">
              Mini CRM
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Dashboard
              </Link>
              <Link
                href="/leads"
                className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Leads
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {tenantName && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {tenantName}
              </Badge>
            )}
            {session.user.role && (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {session.user.role}
              </Badge>
            )}

            <Link
              href="/profile"
              className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              {session.user.name ?? session.user.email}
            </Link>

            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
