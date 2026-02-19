import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { SuperadminSidebar } from '@/components/superadmin-sidebar';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect('/login');
  if (!session.user.isSuperAdmin) redirect('/login');

  return (
    <div className="dark">
      <SidebarProvider>
        <SuperadminSidebar
          userName={session.user.name ?? null}
          userEmail={session.user.email ?? ''}
        />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="text-sm font-medium text-muted-foreground">Super Admin</span>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
