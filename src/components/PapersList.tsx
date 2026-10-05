'use client';
import Link from 'next/link';
import type { UserRole } from '@prisma/client';

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

/* eslint-disable @typescript-eslint/no-explicit-any */
export function PapersList({ papers, userRole }: { papers: any[]; userRole: UserRole }) {
  return (
    <div className="space-y-4">
      {userRole === 'QUESTION_SETTER' && (
        <Link href="/question-papers/create" className="inline-flex px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition">
          + Create Question Paper
        </Link>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Title</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Examination</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Version</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Created</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {papers.map((paper: any) => (
              <tr key={paper.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3 text-gray-200 font-medium">{paper.title}</td>
                <td className="px-4 py-3">
                  <span className="text-gray-400">{paper.examination?.name}</span>
                  {paper.examination?.code && <span className="ml-2 text-xs text-gray-600 font-mono">{paper.examination.code}</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={paper.status} /></td>
                <td className="px-4 py-3 text-gray-400">v{paper.currentVersion}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(paper.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link href={`/question-papers/${paper.id}`} className="text-primary-400 hover:text-primary-300 text-sm transition">
                    View Details →
                  </Link>
                </td>
              </tr>
            ))}
            {papers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No papers found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
