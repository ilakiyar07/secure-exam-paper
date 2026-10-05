import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { SidebarNav } from '@/components/SidebarNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <SidebarNav
        userName={session.name}
        userEmail={session.email}
        userRole={session.role}
      />
      <main className="flex-1 ml-64 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
