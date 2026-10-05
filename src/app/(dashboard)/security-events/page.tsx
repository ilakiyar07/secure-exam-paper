import { getSecurityEvents } from '@/lib/actions/adminActions';
import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';

export default async function SecurityEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role, 'security:read')) redirect('/dashboard');

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10);
  const data = await getSecurityEvents(page);
  
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Security Events</h1>
          <p className="text-gray-400 mt-1">Alerts on integrity failures, unauthorized access, and separation of duties violations</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Timestamp</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Severity</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Event Type</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Description</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Actor</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      event.severity === 'CRITICAL' ? 'bg-danger-600/30 text-danger-400 badge-pulse' :
                      event.severity === 'HIGH' ? 'bg-danger-500/20 text-danger-400' :
                      event.severity === 'MEDIUM' ? 'bg-warning-500/20 text-warning-400' :
                      'bg-gray-600/20 text-gray-400'
                    }`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-200 font-medium">{event.eventType.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-md">
                    {event.description}
                  </td>
                  <td className="px-4 py-3">
                    {event.user ? (
                      <div>
                        <span className="text-gray-300 block">{event.user.name}</span>
                        <span className="text-gray-500 text-xs">{event.user.role}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{event.ipAddress}</td>
                </tr>
              ))}
              {data.events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No security events recorded.
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
