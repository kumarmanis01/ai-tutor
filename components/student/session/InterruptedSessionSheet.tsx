'use client';

/**
 * InterruptedSessionSheet -- v2
 *
 * Bottom sheet (slides up from bottom) shown when an incomplete session
 * exists for the current concept within the last 24 hours.
 *
 * Three choices -- student MUST pick one (cannot dismiss by tapping outside):
 *   ▶ Resume from where I left off
 *   ↺ Restart this topic
 *   → Skip to next topic
 *
 * Height: auto, max 60vh.
 * Drag handle at top.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface InterruptedSession {
  sessionId: string;
  phase: string;
  phaseNumber: number;
  minutesIn: number;
}

interface InterruptedSessionSheetProps {
  session: InterruptedSession;
  conceptId: string;
  subjectId: string;
  topicId: string;
  planItemId: string | null;
  onDismissed: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  OVERVIEW: 'Overview',
  EXPLANATION: 'Explanation',
  PRACTICE: 'Practice',
  TEST: 'Test',
  HOMEWORK: 'Homework',
};

export default function InterruptedSessionSheet({
  session,
  conceptId,
  subjectId,
  topicId,
  planItemId,
  onDismissed,
}: InterruptedSessionSheetProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const phaseLabel = PHASE_LABELS[session.phase] ?? session.phase;

  async function startSession(resumeMode: 'resume' | 'restart') {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/tutor/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conceptId, subjectId, resumeMode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? 'Could not start session. Please try again.');
        setBusy(false);
        return;
      }
      const sessionId = (json as { sessionId?: string }).sessionId;
      onDismissed();
      if (sessionId) {
        const url = `/session/${encodeURIComponent(topicId)}?sid=${encodeURIComponent(sessionId)}&cid=${encodeURIComponent(conceptId)}`;
        router.push(url);
      } else {
        router.push(`/session/${encodeURIComponent(topicId)}`);
      }
    } catch {
      setError('Network error. Please check your connection.');
      setBusy(false);
    }
  }

  async function skipToNext() {
    setError('');
    setBusy(true);
    try {
      if (planItemId) {
        await fetch(`/api/student/learning-plan/${planItemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DEFERRED' }),
        });
      }
      onDismissed();
      router.push('/dashboard');
    } catch {
      setError('Network error. Please check your connection.');
      setBusy(false);
    }
  }

  return (
    /* Backdrop -- non-dismissable, student must choose */
    <div
      className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interrupted-title"
    >
      <div className="w-full max-h-[60vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-slate-900 shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" aria-hidden />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Header */}
          <h2
            id="interrupted-title"
            className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1"
          >
            You left mid-session
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            You were in{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">{phaseLabel}</span> --
            stage {session.phaseNumber} of 7, about {session.minutesIn}{' '}
            {session.minutesIn === 1 ? 'minute' : 'minutes'} in.
          </p>

          {/* Options */}
          <div className="flex flex-col gap-3">
            {/* Resume */}
            <button
              type="button"
              onClick={() => startSession('resume')}
              disabled={busy}
              className="flex items-center gap-4 w-full min-h-[56px] px-4 rounded-xl border-2 border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/15 text-left transition-colors hover:bg-[#534AB7]/10 disabled:opacity-60"
            >
              <span className="text-[#534AB7] text-lg shrink-0">▶</span>
              <div>
                <p className="text-sm font-semibold text-[#534AB7] dark:text-indigo-300">
                  Resume from where I left off
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Continue from {phaseLabel}
                </p>
              </div>
            </button>

            {/* Restart */}
            <button
              type="button"
              onClick={() => startSession('restart')}
              disabled={busy}
              className="flex items-center gap-4 w-full min-h-[56px] px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60"
            >
              <span className="text-gray-600 dark:text-gray-300 text-base shrink-0">↺</span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Restart this topic
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Start fresh from the beginning
                </p>
              </div>
            </button>

            {/* Skip to next */}
            <button
              type="button"
              onClick={skipToNext}
              disabled={busy}
              className="flex items-center gap-4 w-full min-h-[56px] px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60"
            >
              <span className="text-gray-600 dark:text-gray-300 text-base shrink-0">→</span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Skip to next topic
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Move this topic to later in your plan
                </p>
              </div>
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-xs text-[#E24B4A] dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
