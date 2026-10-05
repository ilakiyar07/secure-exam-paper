import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { mfaConfig: true }
  });

  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">My Profile</h1>
          <p className="text-gray-400 mt-1">Manage your account settings and security</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Personal Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <div className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100">
                {user.name}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <div className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100">
                {user.email}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role</label>
              <div className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-primary-400 font-medium">
                {user.role.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Security Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-800 rounded-lg">
              <div>
                <p className="text-gray-200 font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-gray-400 mt-1">Required for all accounts</p>
              </div>
              <div>
                {user.mfaConfig?.isEnabled ? (
                  <span className="px-3 py-1 bg-success-500/20 text-success-400 rounded-full text-xs font-bold">
                    ENABLED
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-danger-500/20 text-danger-400 rounded-full text-xs font-bold">
                    DISABLED
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4 border border-gray-800 rounded-lg">
              <p className="text-gray-200 font-medium">Recent Activity</p>
              <p className="text-sm text-gray-400 mt-1">Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
