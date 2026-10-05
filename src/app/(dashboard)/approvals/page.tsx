import { getMyPapers } from '@/lib/actions/paperActions';
import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';
import { PapersList } from '@/components/PapersList';

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role, 'papers:approve')) redirect('/dashboard');

  const papers = await getMyPapers();
  // Filter papers to only show those that need approval (SUBMITTED, UNDER_REVIEW)
  const pendingPapers = papers.filter(p => ['SUBMITTED', 'UNDER_REVIEW'].includes(p.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Approvals</h1>
          <p className="text-gray-400 mt-1">Review and approve question papers</p>
        </div>
      </div>
      <PapersList papers={pendingPapers} userRole={session.role} />
    </div>
  );
}
