'use client';

/**
 * PreSessionScreen -- v2
 *
 * Full-screen on mobile, centred card max-w-[480px] on desktop.
 * Shows concept info, prerequisite pills, and CTAs.
 *
 * If an interrupted session exists, renders InterruptedSessionSheet
 * as a bottom sheet overlay before the student can start.
 *
 * Prereq pill colours:
 *   masteryScore >= 0.7 → green  "TopicName ✓"
 *   masteryScore 0.4-0.69 → amber "TopicName ~"
 *   masteryScore < 0.4  → red   "TopicName ✗"
 *
 * Copy rules: no "broke", "missed", "failed" -- forward-looking tone only.
 */

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import InterruptedSessionSheet from './InterruptedSessionSheet';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrereqInfo = {
  id: string;
  name: string;
  masteryScore: number;
};

export type InterruptedSession = {
  sessionId: string;
  phase: string;
  phaseNumber: number;
  minutesIn: number;
};

interface PreSessionScreenProps {
  conceptId: string;
  conceptName: string;
  topicId: string;
  subjectId: string;
  subjectName: string;
  chapterName: string;
  estimatedMinutes: number;
  boardMarks: number | null;
  prerequisites: PrereqInfo[];
  interruptedSession: InterruptedSession | null;
  planItemId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prereqPillStyle(masteryScore: number): {
  className: string;
  symbol: string;
} {
  if (masteryScore >= 0.7) {
    return {
      className:
        'bg-[#EAF3DE] text-[#1D9E75] dark:bg-[#1D9E75]/15 dark:text-green-300',
      symbol: '✓',
    };
  }
  if (masteryScore >= 0.4) {
    return {
      className:
        'bg-[#FAEEDA] text-[#BA7517] dark:bg-[#BA7517]/15 dark:text-amber-300',
      symbol: '~',
    };
  }
  return {
    className:
      'bg-[#FCEBEB] text-[#E24B4A] dark:bg-[#E24B4A]/15 dark:text-red-300',
    symbol: '✗',
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PreSessionScreen({
  conceptId,
  conceptName,
  topicId,
  subjectId,
  subjectName,
  chapterName,
  estimatedMinutes,
  boardMarks,
  prerequisites,
  interruptedSession,
  planItemId,
}: PreSessionScreenProps) {
  const router = useRouter();
  const [showSheet, setShowSheet] = useState(interruptedSession !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Prefetch: start the AI tutor session in the background so first AI response
  // arrives faster after the student taps "Start session".
  const prefetchedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tutor/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptId, subjectId }),
    })
      .then((r) => r.json())
      .then((json: { sessionId?: string }) => {
        if (!cancelled && json?.sessionId) {
          prefetchedSessionIdRef.current = json.sessionId;
        }
      })
      .catch(() => {
        // best-effort -- fresh fetch will run on button click
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unmetPrereqs = prerequisites.filter((p) => p.masteryScore < 0.7);
  const hasUnmetPrereqs = unmetPrereqs.length > 0;
  const lowestMasteryPrereq = prerequisites[0]; // sorted ascending in server component

  async function handleStartSession() {
    setError('');
    setBusy(true);
    try {
      // Use prefetched sessionId if available; otherwise do a fresh fetch.
      let sessionId = prefetchedSessionIdRef.current;
      if (!sessionId) {
        const res = await fetch('/api/tutor/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conceptId, subjectId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error ?? 'Could not start session. Please try again.');
          setBusy(false);
          return;
        }
        sessionId = (json as { sessionId?: string }).sessionId ?? null;
      }
      if (!sessionId) {
        setError('Could not start session. Please try again.');
        setBusy(false);
        return;
      }
      // Pass sid (tutor session ID) and cid (concept ID) so the session page
      // can render AITutorSessionShell instead of the V1 SessionContainer.
      const url = `/session/${encodeURIComponent(topicId)}?sid=${encodeURIComponent(sessionId)}&cid=${encodeURIComponent(conceptId)}`;
      router.push(url);
    } catch {
      setError('Network error. Please check your connection.');
      setBusy(false);
    }
  }

  function handleStudyPrerequisites() {
    if (!lowestMasteryPrereq) return;
    router.push(`/session/pre/${encodeURIComponent(lowestMasteryPrereq.id)}`);
  }

  return (
    <>
      {/* Interrupted session bottom sheet -- shown BEFORE the pre-session content */}
      {showSheet && interruptedSession && (
        <InterruptedSessionSheet
          session={interruptedSession}
          conceptId={conceptId}
          subjectId={subjectId}
          topicId={topicId}
          planItemId={planItemId}
          onDismissed={() => setShowSheet(false)}
        />
      )}

      {/* Pre-session screen */}
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-[480px] flex flex-col gap-5">

          {/* Header -- Vidya avatar */}
          <div className="flex justify-center">
            <Image
              src="/logos/vidya/vidya-avatar-128.png"
              alt="Vidya"
              width={48}
              height={48}
              className="rounded-full"
            />
          </div>

          {/* Subject badge */}
          <div>
            <span className="inline-flex items-center rounded-full bg-[#EEEDFE] dark:bg-[#534AB7]/20 px-3 py-1 text-xs font-semibold text-[#534AB7] dark:text-indigo-300">
              {subjectName}
            </span>
          </div>

          {/* Topic name + chapter */}
          <div>
            <h1 className="text-[20px] font-[500] leading-snug text-gray-900 dark:text-gray-100">
              {conceptName}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{chapterName}</p>
          </div>

          {/* Info chips row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              ~{estimatedMinutes} min
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              7 stages
            </span>
            {boardMarks !== null && (
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                {boardMarks} marks · board exam
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-200 dark:bg-slate-800" />

          {/* Prerequisites */}
          {prerequisites.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2.5">
                Prerequisites
              </p>

              <div className="flex flex-wrap gap-2">
                {prerequisites.map((prereq) => {
                  const { className, symbol } = prereqPillStyle(prereq.masteryScore);
                  return (
                    <span
                      key={prereq.id}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${className}`}
                    >
                      {prereq.name}
                      <span aria-hidden>{symbol}</span>
                    </span>
                  );
                })}
              </div>

              {/* Amber warning banner -- only when some prereqs are amber/red */}
              {hasUnmetPrereqs && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#FAEEDA] dark:bg-[#BA7517]/15 px-3 py-2.5">
                  <svg
                    className="w-4 h-4 text-[#BA7517] dark:text-amber-300 shrink-0 mt-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <p className="text-xs text-[#BA7517] dark:text-amber-300 leading-relaxed">
                    Some prerequisites are incomplete. Teacher Vidya will help you catch up.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-[#E24B4A] dark:text-red-400">
              {error}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-3 mt-1">
            {/* Primary: Start session */}
            <button
              type="button"
              onClick={handleStartSession}
              disabled={busy}
              className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-60 transition-all shadow-md shadow-[#534AB7]/25"
            >
              {busy ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Starting...
                </>
              ) : (
                'Start session →'
              )}
            </button>

            {/* Secondary: Study prerequisites first -- only shown when unmet prereqs exist */}
            {hasUnmetPrereqs && lowestMasteryPrereq && (
              <button
                type="button"
                onClick={handleStudyPrerequisites}
                disabled={busy}
                className="flex w-full min-h-[52px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                Study prerequisites first
              </button>
            )}
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Teacher Vidya is already preparing your first question
          </p>
        </div>
      </div>
    </>
  );
}
