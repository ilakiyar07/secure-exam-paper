import { getMyPapers } from '@/lib/actions/paperActions';
import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { PapersList } from '@/components/PapersList';

export default async function QuestionPapersPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const papers = await getMyPapers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Question Papers</h1>
          <p className="text-gray-400 mt-1">
            {session.role === 'QUESTION_SETTER' ? 'Your question papers' :
             session.role === 'REVIEWER' ? 'Papers assigned for review' : 'All question papers'}
          </p>
        </div>
      </div>
      <PapersList papers={papers} userRole={session.role} />
    </div>
  );
}
