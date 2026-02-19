import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect('/login');
  if (!session.user.isSuperAdmin) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/superadmin" className="text-lg font-bold text-red-400">
              ⚙ Super Admin
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-50"
            >
              ← Volver al CRM
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">{session.user.name ?? session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
