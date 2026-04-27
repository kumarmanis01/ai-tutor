'use client';

/**
 * DiagnosticWaitingScreen
 *
 * Shown when the diagnostic page cannot render the test because content is
 * still being generated (topics or questions missing).
 *
 * Behaviours:
 * - On mount: calls POST /api/student/diagnostic/trigger-generation to kick off
 *   the content pipeline immediately (idempotent -- safe to call multiple times).
 * - Polls GET /api/student/diagnostic/check-ready every 5 s.
 * - When ready: reloads the page so the Server Component re-runs and renders the test.
 * - If polling fails 3 times consecutively: surfaces a "Tap to retry" fallback.
 * - "Notify me when ready" remains as a secondary action for students who leave
 *   the page before auto-navigate fires.
 *
 * Props:
 *   subjectId   -- SubjectDef.id
 *   subjectName -- Display name for copy
 *   reason      -- "topics" | "questions"
 *
 * See: docs/v2/on-demand-generator.md
 */

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

export default function DiagnosticWaitingScreen({ subjectId, subjectName, reason }: Props) {
  const [phase, setPhase] = useState<Phase>(reason);
  const [pollFailures, setPollFailures] = useState(0);
  const [notifyState, setNotifyState] = useState<NotifyState>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredRef = useRef(false);
  const inFlightRef = useRef(false);

  // Trigger content generation once on mount.
  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;

    void fetch('/api/student/diagnostic/trigger-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId }),
    }).catch(() => {
      // Non-fatal: generation may already be in flight or topics may already exist.
    });
  }, [subjectId]);

  // Poll check-ready every 5 s; auto-reload when content is in DB.
  // Recursive setTimeout prevents overlapping fetches: the next poll is
  // only scheduled after the current fetch resolves, regardless of how
  // long the server takes. An in-flight guard provides extra safety.
  useEffect(() => {
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      pollRef.current = setTimeout(poll, POLL_INTERVAL_MS) as unknown as ReturnType<typeof setInterval>;
    };

    const poll = async () => {
      if (inFlightRef.current || cancelled) return;
      inFlightRef.current = true;
      try {
        const res = await fetch(
          `/api/student/diagnostic/check-ready?subjectId=${encodeURIComponent(subjectId)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { ready: boolean; phase: Phase };

        setPollFailures(0);

        if (data.ready) {
          cancelled = true;
          window.location.reload();
          return;
        }

        setPhase(data.phase);
      } catch {
        setPollFailures((f) => f + 1);
      } finally {
        inFlightRef.current = false;
        scheduleNext();
      }
    };

    // Run immediately so the student doesn't wait POLL_INTERVAL_MS for the first check.
    void poll();

    return () => {
      cancelled = true;
      if (pollRef.current !== null) {
        clearTimeout(pollRef.current as unknown as ReturnType<typeof setTimeout>);
        pollRef.current = null;
      }
    };
  }, [subjectId]);

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

  const pollingFailed = pollFailures >= MAX_POLL_FAILURES;

  const phaseLabel =
    phase === 'topics'
      ? `Teacher Vidya is loading the ${subjectName} syllabus. This usually takes 2 to 5 minutes.`
      : `Teacher Vidya is preparing your ${subjectName} questions. This usually takes under a minute.`;

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
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{phaseLabel}</p>

        {pollingFailed ? (
          <p className="text-xs text-[#E24B4A] dark:text-red-400 mb-6">
            Could not check status. Tap below to try again.
          </p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
            Checking automatically&hellip; you will be taken to the test when it is ready.
          </p>
        )}

        {pollingFailed && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] transition-all shadow-md shadow-[#534AB7]/25 mb-3"
          >
            Try again
          </button>
        )}

        {!pollingFailed && notifyState === 'idle' && (
          <button
            type="button"
            onClick={handleNotify}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-[#534AB7]/40 text-[#534AB7] dark:text-indigo-300 text-sm font-medium hover:bg-[#EEEDFE] dark:hover:bg-[#534AB7]/10 transition-colors mb-3"
          >
            Notify me when ready
          </button>
        )}

        {notifyState === 'loading' && (
          <p className="text-sm text-[#534AB7] dark:text-indigo-300 mb-3">
            Saving your preference&hellip;
          </p>
        )}

        {notifyState === 'done' && (
          <p className="text-sm text-[#1D9E75] dark:text-green-400 mb-3">
            We will email you as soon as your diagnostic is ready.
          </p>
        )}

        {notifyState === 'error' && (
          <p className="text-sm text-[#E24B4A] dark:text-red-400 mb-3">
            {"Couldn't save preference. You can try again or check back later."}
          </p>
        )}

        <Link
          href="/dashboard"
          className="inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
