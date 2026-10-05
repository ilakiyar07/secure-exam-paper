import { getDashboardStats } from '@/lib/actions/adminActions';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    blue: 'from-primary-600/20 to-primary-600/5 border-primary-600/30 glow-blue',
    green: 'from-success-500/20 to-success-500/5 border-success-500/30 glow-green',
    purple: 'from-accent-600/20 to-accent-600/5 border-accent-600/30 glow-purple',
    red: 'from-danger-500/20 to-danger-500/5 border-danger-500/30 glow-red',
    yellow: 'from-warning-500/20 to-warning-500/5 border-warning-500/30',
  };

  return (
    <div className={`glass-card p-5 bg-gradient-to-br ${colorMap[color] ?? colorMap.blue}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-600/20 text-gray-400',
    SUBMITTED: 'bg-primary-500/20 text-primary-400',
    UNDER_REVIEW: 'bg-warning-500/20 text-warning-400',
    APPROVED: 'bg-success-500/20 text-success-400',
    REJECTED: 'bg-danger-500/20 text-danger-400',
    FINALIZED: 'bg-accent-500/20 text-accent-400',
    SCHEDULED: 'bg-primary-500/20 text-primary-300',
    RELEASED: 'bg-success-500/20 text-success-400 badge-pulse',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-600/20 text-gray-400'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-gray-600/20 text-gray-400',
    MEDIUM: 'bg-warning-500/20 text-warning-400',
    HIGH: 'bg-danger-500/20 text-danger-400',
    CRITICAL: 'bg-danger-600/30 text-danger-400 badge-pulse',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${colors[severity] ?? ''}`}>
      {severity}
    </span>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const stats = await getDashboardStats();
  if (!stats) redirect('/login');

  const icon = (d: string) => (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome back, {session.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} color="blue" icon={icon("M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197")} />
        <StatCard label="Examinations" value={stats.totalExams} color="purple" icon={icon("M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7")} />
        <StatCard label="Total Papers" value={stats.totalPapers} color="green" icon={icon("M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z")} />
        <StatCard label="Pending Approvals" value={stats.pendingApprovals} color="yellow" icon={icon("M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z")} />
      </div>

      {/* Paper Status Breakdown */}
      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Paper Status Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Draft', value: stats.draftPapers, status: 'DRAFT' },
            { label: 'Submitted', value: stats.submittedPapers, status: 'SUBMITTED' },
            { label: 'Approved', value: stats.approvedPapers, status: 'APPROVED' },
            { label: 'Finalized', value: stats.finalizedPapers, status: 'FINALIZED' },
            { label: 'Scheduled', value: stats.scheduledPapers, status: 'SCHEDULED' },
            { label: 'Released', value: stats.releasedPapers, status: 'RELEASED' },
          ].map((item) => (
            <div key={item.status} className="text-center p-3 bg-gray-800/30 rounded-lg">
              <StatusBadge status={item.status} />
              <p className="text-2xl font-bold text-gray-100 mt-2">{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Audit Logs */}
        <div className="glass-card p-5">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Recent Activity</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {stats.recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-2.5 bg-gray-800/30 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${log.success ? 'bg-success-400' : 'bg-danger-400'}`} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-300">
                    <span className="font-medium">{log.user?.name ?? 'System'}</span>
                    {' — '}
                    <span className="text-gray-400">{log.action.replace(/_/g, ' ')}</span>
                  </p>
                  {log.details && <p className="text-xs text-gray-500 truncate mt-0.5">{log.details}</p>}
                  <p className="text-xs text-gray-600 mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {stats.recentAuditLogs.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>

        {/* Recent Security Events */}
        <div className="glass-card p-5">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Security Events</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {stats.recentSecurityEvents.map((event) => (
              <div key={event.id} className="p-2.5 bg-gray-800/30 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-300">{event.eventType.replace(/_/g, ' ')}</span>
                  <SeverityBadge severity={event.severity} />
                </div>
                <p className="text-xs text-gray-400">{event.description}</p>
                <p className="text-xs text-gray-600 mt-1">{new Date(event.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {stats.recentSecurityEvents.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No security events</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
