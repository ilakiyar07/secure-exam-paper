import { getMyPapers } from '@/lib/actions/paperActions';
import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';
import { PapersList } from '@/components/PapersList';

export default async function ReleaseSchedulesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasPermission(session.role, 'papers:schedule')) redirect('/dashboard');

  const papers = await getMyPapers();
  // Filter papers to only show those related to releasing
  const releasePapers = papers.filter(p => ['APPROVED', 'FINALIZED', 'SCHEDULED', 'RELEASED'].includes(p.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Release Schedules</h1>
          <p className="text-gray-400 mt-1">Manage scheduling and paper finalization</p>
        </div>
      </div>
      <PapersList papers={releasePapers} userRole={session.role} />
    </div>
  );
}
