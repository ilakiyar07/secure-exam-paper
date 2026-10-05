'use client';
import { useState } from 'react';
import { createExamination } from '@/lib/actions/paperActions';
import { useRouter } from 'next/navigation';

type ExamItem = {
  id: string; name: string; code: string; subject: string;
  examDate: Date; duration: number; totalMarks: number; isActive: boolean;
  createdAt: Date; _count: { papers: number };
};

export function ExaminationList({ examinations, canCreate }: { examinations: ExamItem[]; canCreate: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await createExamination(formData);
    if (result.success) {
      setShowForm(false);
      router.refresh();
    } else {
      setError(result.error ?? 'Failed');
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition">
          {showForm ? 'Cancel' : '+ Create Examination'}
        </button>
      )}

      {showForm && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Create Examination</h3>
          {error && <div className="mb-4 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg text-danger-400 text-sm">{error}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-300 mb-1">Name</label><input name="name" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" /></div>
            <div><label className="block text-sm text-gray-300 mb-1">Code</label><input name="code" required placeholder="e.g., EXAM-2025-CS" className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none uppercase" /></div>
            <div><label className="block text-sm text-gray-300 mb-1">Subject</label><input name="subject" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" /></div>
            <div><label className="block text-sm text-gray-300 mb-1">Exam Date</label><input name="examDate" type="date" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" /></div>
            <div><label className="block text-sm text-gray-300 mb-1">Duration (min)</label><input name="duration" type="number" required min={1} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" /></div>
            <div><label className="block text-sm text-gray-300 mb-1">Total Marks</label><input name="totalMarks" type="number" required min={1} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" /></div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-300 mb-1">Description</label><textarea name="description" rows={2} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" /></div>
            <div className="md:col-span-2">
              <button type="submit" disabled={loading} className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
                {loading ? 'Creating...' : 'Create Examination'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Code</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Subject</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Exam Date</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Duration</th>
            <th className="px-4 py-3 text-left text-gray-400 font-medium">Papers</th>
          </tr></thead>
          <tbody>
            {examinations.map((exam) => (
              <tr key={exam.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded text-xs font-mono">{exam.code}</span></td>
                <td className="px-4 py-3 text-gray-200 font-medium">{exam.name}</td>
                <td className="px-4 py-3 text-gray-400">{exam.subject}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(exam.examDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-400">{exam.duration} min</td>
                <td className="px-4 py-3 text-gray-400">{exam._count.papers}</td>
              </tr>
            ))}
            {examinations.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No examinations yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
