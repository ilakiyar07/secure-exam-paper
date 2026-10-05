import { getAuditLogs } from '@/lib/actions/adminActions';
import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role, 'audit:read')) redirect('/dashboard');

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10);
  const data = await getAuditLogs(page);
  
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Audit Logs</h1>
          <p className="text-gray-400 mt-1">System-wide tamper-evident activity trails</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Timestamp</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">User</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Action</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Resource</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {log.user ? (
                      <div>
                        <span className="text-gray-200 block">{log.user.name}</span>
                        <span className="text-gray-500 text-xs">{log.user.role}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-300 font-mono text-xs">{log.action}</span>
                    {log.details && <p className="text-gray-500 text-xs mt-1 max-w-xs truncate">{log.details}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    <span className="block">{log.resource}</span>
                    <span className="text-gray-600 text-xs font-mono">{log.resourceId}</span>
                  </td>
                  <td className="px-4 py-3">
                    {log.success ? (
                      <span className="text-success-400 font-medium">SUCCESS</span>
                    ) : (
                      <span className="text-danger-400 font-medium">FAILURE</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.ipAddress}</td>
                </tr>
              ))}
              {data.logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
