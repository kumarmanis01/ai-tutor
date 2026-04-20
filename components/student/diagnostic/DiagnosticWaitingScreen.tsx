'use client';

/**
 * DiagnosticWaitingScreen
 *
 * Shown when the diagnostic page cannot render the test because content is
 * still being generated (topics or questions missing).
 *
 * Behaviours:
 * - Auto-refreshes every 30 s via a countdown timer that triggers a full reload.
 * - "Notify me when ready" button calls POST /api/student/diagnostic/notify-ready
 *   so the dailyMaintenance job can email the student once questions arrive.
 * - Falls back gracefully if the notify endpoint is unavailable.
 *
 * Props:
 *   subjectId   -- SubjectDef.id (used for the notify request)
 *   subjectName -- Display name for copy
 *   reason      -- "topics" (syllabus not yet generated) | "questions" (questions not yet generated)
 */

import React, { useEffect, useState, useCallback } from 'react';

const REFRESH_SECONDS = 30;

interface Props {
  subjectId: string;
  subjectName: string;
  reason: 'topics' | 'questions';
}

export default function DiagnosticWaitingScreen({ subjectId, subjectName, reason }: Props) {
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [notifyState, setNotifyState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          window.location.reload();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNotify = useCallback(async () => {
    setNotifyState('loading');
    try {
      const res = await fetch('/api/student/diagnostic/notify-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId }),
      });
      setNotifyState(res.ok ? 'done' : 'error');
    } catch {
      setNotifyState('error');
    }
  }, [subjectId]);

  const bodyText =
    reason === 'topics'
      ? `Teacher Vidya is loading the ${subjectName} syllabus. This usually takes a few minutes.`
      : `Teacher Vidya is preparing your ${subjectName} questions. This usually takes a few minutes.`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EEEDFE] dark:bg-[#534AB7]/20 flex items-center justify-center mx-auto mb-5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#534AB7"
            strokeWidth="2"
            className="w-8 h-8 animate-spin"
            aria-hidden
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>

        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Vidya is getting ready
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{bodyText}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
          Refreshing automatically in {countdown}s&hellip;
        </p>

        {notifyState === 'idle' && (
          <button
            type="button"
            onClick={handleNotify}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] transition-all shadow-md shadow-[#534AB7]/25 mb-3"
          >
            Notify me when ready
          </button>
        )}

        {notifyState === 'loading' && (
          <p className="text-sm text-[#534AB7] dark:text-indigo-300 mb-3">Saving your preference&hellip;</p>
        )}

        {notifyState === 'done' && (
          <p className="text-sm text-[#1D9E75] dark:text-green-400 mb-3">
            We will email you as soon as your diagnostic is ready.
          </p>
        )}

        {notifyState === 'error' && (
          <p className="text-sm text-[#E24B4A] dark:text-red-400 mb-3">
            Couldn&apos;t save preference. You can try again or check back later.
          </p>
        )}

        <a
          href="/dashboard"
          className="inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
