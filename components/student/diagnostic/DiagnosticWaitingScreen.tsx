'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_FAILURES = 3;

type Phase = 'topics' | 'questions' | 'ready';
type NotifyState = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  subjectId: string;
  subjectName: string;
  reason: 'topics' | 'questions';
}

const PHASE_MESSAGES: Record<Phase, string> = {
  topics: 'Building the syllabus for your subject...',
  questions: 'Generating your diagnostic questions...',
  ready: 'Your diagnostic is ready!',
};

export default function DiagnosticWaitingScreen({ subjectId, subjectName, reason }: Props) {
  const [phase, setPhase] = useState<Phase>(reason);
  const [pollFailures, setPollFailures] = useState(0);
  const [notifyState, setNotifyState] = useState<NotifyState>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredRef = useRef(false);
  const inFlightRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const checkReady = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/student/diagnostic/check-ready?subjectId=${encodeURIComponent(subjectId)}`);
      if (!res.ok) {
        setPollFailures((n) => n + 1);
        return;
      }
      const data = await res.json() as { ready: boolean; phase: Phase };
      setPollFailures(0);
      setPhase(data.phase ?? 'topics');
      if (data.ready) {
        stopPolling();
        window.location.reload();
      }
    } catch {
      setPollFailures((n) => n + 1);
    } finally {
      inFlightRef.current = false;
    }
  }, [subjectId, stopPolling]);

  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    void fetch('/api/student/diagnostic/trigger-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId }),
    }).catch(() => {});
  }, [subjectId]);

  useEffect(() => {
    pollRef.current = setInterval(checkReady, POLL_INTERVAL_MS);
    void checkReady();
    return stopPolling;
  }, [checkReady, stopPolling]);

  async function handleNotify() {
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
  }

  const tooManyFailures = pollFailures >= MAX_POLL_FAILURES;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EEEDFE] dark:bg-[#534AB7]/20 flex items-center justify-center mx-auto mb-6">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#534AB7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Vidya is preparing your questions
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {tooManyFailures
            ? "Something went wrong. Tap below to try again."
            : PHASE_MESSAGES[phase]}
        </p>

        <p className="text-sm font-medium text-[#534AB7] dark:text-indigo-300 mb-6">
          {subjectName}
        </p>

        {!tooManyFailures && (
          <div className="flex gap-1.5 justify-center mb-8">
            {(['topics', 'questions', 'ready'] as Phase[]).map((p) => (
              <div
                key={p}
                className={[
                  'w-2 h-2 rounded-full transition-colors duration-300',
                  p === phase
                    ? 'bg-[#534AB7] scale-125'
                    : ['topics', 'questions'].indexOf(p) < ['topics', 'questions', 'ready'].indexOf(phase)
                    ? 'bg-[#1D9E75]'
                    : 'bg-gray-200 dark:bg-slate-700',
                ].join(' ')}
              />
            ))}
          </div>
        )}

        {tooManyFailures && (
          <button
            type="button"
            onClick={() => { setPollFailures(0); void checkReady(); }}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] transition-all shadow-md shadow-[#534AB7]/25 mb-3"
          >
            Try again
          </button>
        )}

        {notifyState === 'idle' && !tooManyFailures && (
          <button
            type="button"
            onClick={handleNotify}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors mb-3"
          >
            Email me when ready
          </button>
        )}

        {notifyState === 'loading' && (
          <p className="text-sm text-[#534AB7] mb-3">Saving your preference...</p>
        )}

        {notifyState === 'done' && (
          <p className="text-sm text-[#1D9E75] dark:text-green-400 mb-3">
            We will email you when your diagnostic is ready.
          </p>
        )}

        {notifyState === 'error' && (
          <button
            type="button"
            onClick={handleNotify}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors mb-3"
          >
            Try again
          </button>
        )}

        <Link
          href="/student/diagnostics"
          className="inline-flex w-full min-h-[44px] items-center justify-center text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Back to subjects
        </Link>
      </div>
    </div>
  );
}
