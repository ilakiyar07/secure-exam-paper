'use client';
import { useState, useEffect } from 'react';
import { createQuestionPaper, uploadQuestionPaper, submitPaper, getExaminations } from '@/lib/actions/paperActions';
import { useRouter } from 'next/navigation';

export default function CreatePaperPage() {
  const [step, setStep] = useState(1);
  const [paperId, setPaperId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sha256, setSha256] = useState('');
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [exams, setExams] = useState<any[]>([]);
  const [uploadResult, setUploadResult] = useState<{ version: number; sha256: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    getExaminations().then(setExams);
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await createQuestionPaper(formData);
    if (result.success && result.paperId) {
      setPaperId(result.paperId);
      setStep(2);
    } else {
      setError(result.error ?? 'Failed');
    }
    setLoading(false);
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    formData.set('paperId', paperId);
    const result = await uploadQuestionPaper(formData);
    if (result.success) {
      setUploadResult({ version: result.version!, sha256: result.sha256! });
      setSha256(result.sha256!);
      setStep(3);
    } else {
      setError(result.error ?? 'Upload failed');
    }
    setLoading(false);
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    const result = await submitPaper(paperId);
    if (result.success) {
      router.push('/question-papers');
    } else {
      setError(result.error ?? 'Submit failed');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Create Question Paper</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${s <= step ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{s}</div>
            <span className={`text-sm ${s <= step ? 'text-gray-200' : 'text-gray-600'}`}>
              {s === 1 ? 'Details' : s === 2 ? 'Upload' : 'Submit'}
            </span>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-primary-600' : 'bg-gray-800'}`} />}
          </div>
        ))}
      </div>

      {error && <div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg text-danger-400 text-sm">{error}</div>}

      {/* Step 1: Create Paper */}
      {step === 1 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Paper Details</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Examination</label>
              <select name="examinationId" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none">
                <option value="">Select examination</option>
                {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Title</label>
              <input name="title" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              {loading ? 'Creating...' : 'Next: Upload PDF →'}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Upload PDF */}
      {step === 2 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Upload Question Paper (PDF)</h3>
          <div className="mb-4 p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg text-primary-300 text-sm">
            <strong>🔐 Security:</strong> Your file will be encrypted with AES-256-GCM before storage. Only the encrypted version is stored.
          </div>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">PDF File</label>
              <input name="file" type="file" accept=".pdf,application/pdf" required className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 file:mr-3 file:px-3 file:py-1 file:bg-primary-600 file:text-white file:rounded file:border-0 file:text-sm file:cursor-pointer" />
              <p className="text-xs text-gray-500 mt-1">Max 50 MB. PDF only. File signature verified.</p>
            </div>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              {loading ? 'Encrypting & Uploading...' : 'Upload & Encrypt →'}
            </button>
          </form>
        </div>
      )}

      {/* Step 3: Confirm & Submit */}
      {step === 3 && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Upload Successful ✓</h3>
          <div className="p-4 bg-success-500/10 border border-success-500/30 rounded-lg space-y-2">
            <p className="text-success-400 text-sm font-medium">File encrypted and stored securely</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-400">Version:</span>
              <span className="text-gray-200 font-mono">v{uploadResult?.version}</span>
              <span className="text-gray-400">SHA-256 Hash:</span>
              <span className="text-gray-200 font-mono text-xs break-all">{sha256}</span>
              <span className="text-gray-400">Encryption:</span>
              <span className="text-gray-200">AES-256-GCM</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 bg-success-500 hover:bg-success-400 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit for Review'}
            </button>
            <button onClick={() => router.push('/question-papers')} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition">
              Save as Draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
