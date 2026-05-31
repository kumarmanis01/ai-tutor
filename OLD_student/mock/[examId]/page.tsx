"use client";

/**
 * /mock/[examId] -- Mock Exam Runner Page -- F-STU-021
 *
 * Calls POST /api/mock/[examId]/start on mount to create an attempt and
 * fetch the full exam structure, then renders MockExamRunner.
 *
 * Loading: skeleton matching the sticky-header + section-tabs layout.
 * Error: "Couldn't load -- tap to retry" with retry button.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created for F-STU-021
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MockExamRunner, { MockExamRunnerProps } from '@/components/mock/MockExamRunner';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MockExamRunnerProps };

export default function MockExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: 'loading' });

  async function startExam() {
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/mock/${examId}/start`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start exam');
      setState({ status: 'ready', data: json as MockExamRunnerProps });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load exam';
      setState({ status: 'error', message });
    }
  }

  useEffect(() => {
    if (examId) startExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 dark:bg-slate-900">
        {/* Skeleton sticky header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-gray-200 dark:bg-slate-600 animate-pulse" />
              <div className="h-4 w-48 rounded bg-gray-200 dark:bg-slate-600 animate-pulse" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-gray-200 dark:bg-slate-600 animate-pulse" />
          </div>
        </div>

        {/* Skeleton section tabs */}
        <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
          <div className="max-w-3xl mx-auto flex gap-2 px-4 py-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-11 w-24 rounded-lg bg-gray-200 dark:bg-slate-600 animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* Skeleton questions */}
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
            >
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-slate-600 animate-pulse mb-3" />
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-11 rounded-lg bg-gray-100 dark:bg-slate-700 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 bg-gray-50 dark:bg-slate-900 gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {state.message || "Couldn't load the exam. Please try again."}
        </p>
        <div className="flex gap-3">
          <button
            onClick={startExam}
            className="min-h-[44px] px-5 rounded-lg bg-[#534AB7] text-white text-sm font-semibold transition-colors hover:bg-[#4339a6]"
          >
            Retry
          </button>
          <button
            onClick={() => router.push('/mock')}
            className="min-h-[44px] px-5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-colors hover:bg-gray-200 dark:hover:bg-slate-600"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return <MockExamRunner {...state.data} />;
}
