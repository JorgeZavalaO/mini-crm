import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect('/login');
  if (!session.user.isSuperAdmin) redirect('/login');

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/superadmin" className="text-lg font-bold text-red-400">
              ⚙ Super Admin
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {session.user.name ?? session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
