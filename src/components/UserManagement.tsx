'use client';
import { useState } from 'react';
import { createUser, toggleUserActive, unlockUser } from '@/lib/actions/adminActions';
import { useRouter } from 'next/navigation';

type UserItem = {
  id: string; email: string; name: string; role: string;
  isActive: boolean; isLocked: boolean; lastLoginAt: Date | null; createdAt: Date;
  _count: { createdPapers: number };
};

export function UserManagement({ users, canCreate }: { users: UserItem[]; canCreate: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'bg-danger-500/20 text-danger-400',
    EXAM_CONTROLLER: 'bg-primary-500/20 text-primary-400',
    QUESTION_SETTER: 'bg-success-500/20 text-success-400',
    REVIEWER: 'bg-warning-500/20 text-warning-400',
    SECURITY_AUDITOR: 'bg-accent-500/20 text-accent-400',
  };

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await createUser(formData);
    if (result.success) {
      setShowForm(false);
      router.refresh();
    } else {
      setError(result.error ?? 'Failed to create user');
    }
    setLoading(false);
  }

  async function handleToggle(userId: string) {
    await toggleUserActive(userId);
    router.refresh();
  }

  async function handleUnlock(userId: string) {
    await unlockUser(userId);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition"
        >
          {showForm ? 'Cancel' : '+ Create User'}
        </button>
      )}

      {showForm && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Create New User</h3>
          {error && <div className="mb-4 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg text-danger-400 text-sm">{error}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Name</label>
              <input name="name" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input name="email" type="email" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Password</label>
              <input name="password" type="password" required minLength={12} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" placeholder="Min 12 chars, upper, lower, digit, special" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Role</label>
              <select name="role" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="">Select role</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="EXAM_CONTROLLER">Exam Controller</option>
                <option value="QUESTION_SETTER">Question Setter</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="SECURITY_AUDITOR">Security Auditor</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={loading} className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Role</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Papers</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Last Login</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 text-gray-200 font-medium">{user.name}</td>
                <td className="px-4 py-3 text-gray-400">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] ?? ''}`}>
                    {user.role.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-success-500/20 text-success-400' : 'bg-gray-600/20 text-gray-500'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {user.isLocked && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-danger-500/20 text-danger-400">Locked</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400">{user._count.createdPapers}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggle(user.id)}
                      className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition"
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    {user.isLocked && (
                      <button
                        onClick={() => handleUnlock(user.id)}
                        className="px-2 py-1 text-xs bg-warning-500/20 hover:bg-warning-500/30 text-warning-400 rounded transition"
                      >
                        Unlock
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
