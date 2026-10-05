import { getExaminations } from '@/lib/actions/paperActions';
import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';
import { ExaminationList } from '@/components/ExaminationList';

export default async function ExaminationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const exams = await getExaminations();
  const canCreate = hasPermission(session.role, 'examinations:create');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Examinations</h1>
        <p className="text-gray-400 mt-1">Manage competitive examinations</p>
      </div>
      <ExaminationList examinations={exams} canCreate={canCreate} />
    </div>
  );
}
