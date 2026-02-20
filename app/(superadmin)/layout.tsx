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
    <SidebarProvider defaultOpen={true} className="dark">
      <SuperadminSidebar
        userName={session.user.name ?? null}
        userEmail={session.user.email ?? ''}
      />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">Super Admin</span>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
