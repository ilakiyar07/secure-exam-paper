import { getUsers } from '@/lib/actions/adminActions';
import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';
import { UserManagement } from '@/components/UserManagement';

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role, 'users:read')) redirect('/dashboard');

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">User Management</h1>
          <p className="text-gray-400 mt-1">Manage system users and their roles</p>
        </div>
      </div>
      <UserManagement users={users} canCreate={hasPermission(session.role, 'users:create')} />
    </div>
  );
}
