'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getPaperById, assignReviewer, reviewPaper, finalizePaper, scheduleRelease } from '@/lib/actions/paperActions';
import { getReviewers } from '@/lib/actions/adminActions';
import type { UserRole } from '@prisma/client';

export default function PaperDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [paper, setPaper] = useState<any>(null);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const p = await getPaperById(resolvedParams.id);
        if (!p) {
          setError('Paper not found or access denied');
          setLoading(false);
          return;
        }
        setPaper(p);
        
        // Load reviewers if needed
        const r = await getReviewers();
        setReviewers(r);
      } catch (e: any) {
        setError(e.message ?? 'Error loading data');
      }
      setLoading(false);
    }
    loadData();
  }, [resolvedParams.id]);

  async function handleAssignReviewer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionLoading(true);
    const formData = new FormData(e.currentTarget);
    const reviewerId = formData.get('reviewerId') as string;
    const res = await assignReviewer(paper.id, reviewerId);
    if (res.success) {
      router.refresh();
      window.location.reload();
    } else {
      alert(res.error);
    }
    setActionLoading(false);
  }

  async function handleReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append('paperId', paper.id);
    const res = await reviewPaper(formData);
    if (res.success) {
      router.refresh();
      window.location.reload();
    } else {
      alert(res.error);
    }
    setActionLoading(false);
  }

  async function handleFinalize() {
    setActionLoading(true);
    const res = await finalizePaper(paper.id);
    if (res.success) {
      router.refresh();
      window.location.reload();
    } else {
      alert(res.error);
    }
    setActionLoading(false);
  }

  async function handleSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append('paperId', paper.id);
    const res = await scheduleRelease(formData);
    if (res.success) {
      router.refresh();
      window.location.reload();
    } else {
      alert(res.error);
    }
    setActionLoading(false);
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error || !paper) return <div className="p-8 text-center text-danger-400">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{paper.title}</h1>
          <p className="text-gray-400 mt-1">
            {paper.examination.name} ({paper.examination.code})
          </p>
        </div>
        <div>
          <span className="px-3 py-1 bg-gray-800 text-gray-200 rounded-full text-sm border border-gray-700">
            Status: <strong className="text-primary-400">{paper.status}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Metadata</h3>
          <div className="space-y-3 text-sm">
            <p><span className="text-gray-400">Created By:</span> {paper.createdBy.name} ({paper.createdBy.role})</p>
            <p><span className="text-gray-400">Created At:</span> {new Date(paper.createdAt).toLocaleString()}</p>
            <p><span className="text-gray-400">Current Version:</span> v{paper.currentVersion}</p>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Latest Version Details</h3>
          {paper.versions[0] ? (
            <div className="space-y-3 text-sm">
              <p><span className="text-gray-400">SHA-256 Hash:</span></p>
              <p className="font-mono text-xs text-gray-300 break-all bg-gray-900 p-2 rounded">{paper.versions[0].sha256Hash}</p>
              <p><span className="text-gray-400">Size:</span> {(paper.versions[0].fileSize / 1024).toFixed(2)} KB</p>
              <p><span className="text-gray-400">Signature:</span> {paper.versions[0].digitalSignature ? <span className="text-success-400 font-bold">SIGNED</span> : <span className="text-warning-400">UNSIGNED</span>}</p>
            </div>
          ) : (
            <p className="text-gray-500">No versions uploaded.</p>
          )}
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Actions</h3>
        <div className="space-y-6">
          {/* ASSIGN REVIEWER */}
          {['SUBMITTED', 'UNDER_REVIEW'].includes(paper.status) && (
            <div className="p-4 border border-gray-800 rounded-lg">
              <h4 className="text-md font-medium text-gray-300 mb-2">Assign Reviewer</h4>
              <form onSubmit={handleAssignReviewer} className="flex gap-4">
                <select name="reviewerId" required className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 flex-1">
                  <option value="">Select a reviewer</option>
                  {reviewers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.email})</option>)}
                </select>
                <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg">
                  Assign
                </button>
              </form>
            </div>
          )}

          {/* APPROVAL / REVIEW */}
          {['SUBMITTED', 'UNDER_REVIEW'].includes(paper.status) && (
            <div className="p-4 border border-gray-800 rounded-lg">
              <h4 className="text-md font-medium text-gray-300 mb-2">Submit Review</h4>
              <form onSubmit={handleReview} className="space-y-4">
                <select name="action" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100">
                  <option value="">Select Action</option>
                  <option value="APPROVED">Approve Paper</option>
                  <option value="REJECTED">Reject Paper</option>
                </select>
                <textarea name="comments" placeholder="Review comments (optional)" rows={3} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100"></textarea>
                <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg">
                  Submit Review
                </button>
              </form>
            </div>
          )}

          {/* FINALIZE */}
          {paper.status === 'APPROVED' && (
            <div className="p-4 border border-gray-800 rounded-lg flex items-center justify-between">
              <div>
                <h4 className="text-md font-medium text-gray-300">Finalize & Sign Paper</h4>
                <p className="text-sm text-gray-500 mt-1">This will digitally sign the encrypted content and prepare it for scheduling.</p>
              </div>
              <button onClick={handleFinalize} disabled={actionLoading} className="px-6 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg font-medium">
                Finalize Paper
              </button>
            </div>
          )}

          {/* SCHEDULE */}
          {paper.status === 'FINALIZED' && (
            <div className="p-4 border border-gray-800 rounded-lg">
              <h4 className="text-md font-medium text-gray-300 mb-2">Schedule Release</h4>
              <form onSubmit={handleSchedule} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Schedule Date</label>
                  <input type="date" name="scheduledDate" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Exact Release Time</label>
                  <input type="datetime-local" name="releaseTime" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100" />
                </div>
                <button type="submit" disabled={actionLoading} className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg mb-[1px]">
                  Schedule
                </button>
              </form>
            </div>
          )}
          
          {/* DOWNLOAD / RELEASE */}
          {['SCHEDULED', 'RELEASED'].includes(paper.status) && (
            <div className="p-4 border border-gray-800 rounded-lg">
               <h4 className="text-md font-medium text-gray-300 mb-2">Release Information</h4>
               {paper.releaseSchedule && (
                 <div className="text-sm text-gray-400 mb-4">
                   <p>Scheduled For: {new Date(paper.releaseSchedule.releaseTime).toLocaleString()}</p>
                 </div>
               )}
               <a href={`/api/papers/${paper.id}/download`} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-2 bg-success-600 hover:bg-success-500 text-white rounded-lg font-medium">
                 Download Paper (Server Release Check)
               </a>
            </div>
          )}

          {/* APPROVAL HISTORY */}
          {paper.approvals.length > 0 && (
            <div className="mt-6 border-t border-gray-800 pt-6">
              <h4 className="text-md font-medium text-gray-300 mb-4">Approval History</h4>
              <div className="space-y-3">
                {paper.approvals.map((a: any) => (
                  <div key={a.id} className="p-3 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-200">{a.user.name} ({a.user.role})</span>
                      <span className={a.action === 'APPROVED' ? 'text-success-400' : 'text-danger-400'}>{a.action}</span>
                    </div>
                    {a.comments && <p className="text-sm text-gray-400 mt-2">"{a.comments}"</p>}
                    <p className="text-xs text-gray-500 mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
