'use client';

/**
 * MockExamListClient -- client component for the mock exam selection page.
 *
 * AC-06: Shows available mocks; "Generate" CTA creates a new version
 *         (up to 5+ unique papers per subject/grade via /api/mock/generate).
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created for F-STU-021
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { showAlert } from '@/lib/alerts';
import { SpinnerLoader } from '@/components/UI/loaders';

interface MockItem {
  id: string;
  title: string;
  subjectName: string;
  totalMarks: number;
  durationMin: number;
  version: number;
  attemptCount: number;
}

interface Props {
  mocks: MockItem[];
  subjects: string[];
  grade: string;
  board: string;
}

export default function MockExamListClient({ mocks, subjects, grade, board }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0] ?? '');

  async function handleGenerate() {
    if (!selectedSubject || generating) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/mock/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectName: selectedSubject }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate exam');
      router.refresh(); // reload the server component to show new exam
    } catch (e: any) {
      showAlert({
        title: 'Error',
        message: e.message ?? 'Failed to generate exam',
        variant: 'error',
      });
    } finally {
      setGenerating(false);
    }
  }

  const subjectCounts = subjects.reduce<Record<string, number>>((acc, s) => {
    acc[s] = mocks.filter((m) => m.subjectName.toLowerCase() === s.toLowerCase()).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Generate new mock CTA -- AC-06 */}
      {subjects.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Generate a New Full Mock
          </h2>
          <div className="flex gap-3 flex-wrap">
            {subjects.length > 1 && (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="min-h-[44px] flex-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
              >
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s} ({subjectCounts[s] ?? 0} papers)
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedSubject}
              className="min-h-[44px] px-5 rounded-lg bg-[#534AB7] text-white text-sm font-semibold disabled:opacity-50 transition-colors hover:bg-[#4339a6] whitespace-nowrap"
            >
              <span className="flex items-center justify-center gap-2">
                {generating && <SpinnerLoader size="small" color="#ffffff" />}
                {generating ? 'Generating...' : '+ New Paper'}
              </span>
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Each paper draws from the full syllabus with fresh question selection.
          </p>
        </div>
      )}

      {/* Available mocks list */}
      {mocks.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            No mock exams available yet for Grade {grade} · {board}.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Click "+ New Paper" above to generate your first mock exam.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mocks.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{m.title}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {m.totalMarks} marks · {m.durationMin} min
                  </span>
                  {m.attemptCount > 0 && (
                    <span className="text-xs text-[#1D9E75] font-medium">
                      {m.attemptCount} attempt{m.attemptCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <a
                href={`/mock/${m.id}`}
                className="min-h-[44px] px-4 rounded-lg bg-[#534AB7] text-white text-sm font-semibold flex items-center justify-center transition-colors hover:bg-[#4339a6] whitespace-nowrap"
              >
                {m.attemptCount > 0 ? 'Retake' : 'Start'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
