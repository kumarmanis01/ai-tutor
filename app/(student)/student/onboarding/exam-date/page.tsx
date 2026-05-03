'use client';

/**
 * Exam Date Capture -- v2 onboarding Screen 4
 *
 * Collects:
 *   - Board exam date (text input, parsed by browser)
 *   - Study days per week (3 / 4 / 5 / 6 / 7 tap buttons)
 *
 * Live estimate: "With N days/week and N weeks -- we'll cover all chapters
 *                with time for N revision rounds"
 *
 * CTAs:
 *   - "Build my learning plan" -- POSTs to /api/student/onboarding/generate-plan
 *     then redirects to /student/learning-map
 *   - "No upcoming exam -- set a 6-month plan" -- same but examDate = null
 */

import React, { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STUDY_DAY_OPTIONS = [3, 4, 5, 6, 7];
const DEFAULT_STUDY_DAYS = 5;
/** Default concept count -- CBSE Grade 10 has ~60 concepts across subjects. */
const TOTAL_CONCEPTS = 60;

interface EstimateResult {
  weeksToComplete: number;
  months: string;
  revisionRounds: number;
  sufficient: boolean;
  /** Weeks to spare when exam date is set and pace is sufficient. */
  spareWeeks: number;
  /** Minimum days/week needed when pace is insufficient for the exam date. */
  daysNeeded: number;
}

/**
 * Calculates study plan estimate from days/week and optional exam date.
 * - No exam date: weeksToComplete based on TOTAL_CONCEPTS / daysPerWeek.
 * - Exam date set: compares available weeks to weeksToComplete; flags if pace is insufficient.
 */
function computeEstimate(daysPerWeek: number, weeksUntilExam: number | null): EstimateResult {
  const sessionsNeeded = TOTAL_CONCEPTS; // one session per concept
  const weeksToComplete = Math.ceil(sessionsNeeded / daysPerWeek);
  const totalSessions = weeksToComplete * daysPerWeek;
  const revisionRounds = Math.max(
    1,
    Math.floor((totalSessions - sessionsNeeded) / (TOTAL_CONCEPTS / 3))
  );
  const months = (weeksToComplete / 4.33).toFixed(1);

  if (weeksUntilExam === null) {
    return {
      weeksToComplete,
      months,
      revisionRounds,
      sufficient: true,
      spareWeeks: 0,
      daysNeeded: 0,
    };
  }

  if (weeksUntilExam >= weeksToComplete) {
    const spareWeeks = weeksUntilExam - weeksToComplete;
    return { weeksToComplete, months, revisionRounds, sufficient: true, spareWeeks, daysNeeded: 0 };
  }

  const daysNeeded = Math.ceil(sessionsNeeded / weeksUntilExam);
  return {
    weeksToComplete,
    months,
    revisionRounds: 0,
    sufficient: false,
    spareWeeks: 0,
    daysNeeded,
  };
}

function parseExamDate(raw: string): Date | null {
  if (!raw.trim()) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime()) && d > new Date()) return d;
  return null;
}

function weeksUntil(date: Date | null): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  return Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
}

export default function ExamDatePage() {
  const router = useRouter();

  const [examDateRaw, setExamDateRaw] = useState('');
  const [studyDays, setStudyDays] = useState(DEFAULT_STUDY_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // When the API returns diagnosticReady:false the page switches to a waiting view
  const [waitingForDiagnostic, setWaitingForDiagnostic] = useState<{
    subjectId: string;
    notifyState: 'idle' | 'loading' | 'done' | 'error';
  } | null>(null);

  const parsedDate = useMemo(() => parseExamDate(examDateRaw), [examDateRaw]);
  const weeks = useMemo(() => weeksUntil(parsedDate), [parsedDate]);
  const estimate = useMemo(() => computeEstimate(studyDays, weeks), [studyDays, weeks]);

  const sendNotifyRequest = useCallback(async (subjectId: string) => {
    setWaitingForDiagnostic((prev) => (prev ? { ...prev, notifyState: 'loading' } : null));
    try {
      const res = await fetch('/api/student/diagnostic/notify-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId }),
      });
      setWaitingForDiagnostic((prev) =>
        prev ? { ...prev, notifyState: res.ok ? 'done' : 'error' } : null
      );
    } catch {
      setWaitingForDiagnostic((prev) => (prev ? { ...prev, notifyState: 'error' } : null));
    }
  }, []);

  async function generatePlan(includeExamDate: boolean) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/student/onboarding/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate: includeExamDate && parsedDate ? parsedDate.toISOString() : null,
          studyDaysPerWeek: studyDays,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      const firstSubjectId: string | null = json?.firstSubjectId ?? null;
      const diagnosticReady: boolean = json?.diagnosticReady ?? true;

      if (!firstSubjectId) {
        router.push('/dashboard');
        return;
      }

      if (!diagnosticReady) {
        // Content pipeline is still running -- show waiting screen instead of
        // redirecting to a broken diagnostic page
        setWaitingForDiagnostic({ subjectId: firstSubjectId, notifyState: 'idle' });
        return;
      }

      // router.push('/student/onboarding/diagnostic');
      router.push('/dashboard');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setBusy(false);
    }
  }

  const hasValidDate = parsedDate !== null;
  const dateError = examDateRaw.trim() && !hasValidDate ? 'Please select a future date.' : '';

  // Waiting screen: content pipeline still running, diagnostic not yet available
  if (waitingForDiagnostic) {
    const { subjectId, notifyState } = waitingForDiagnostic;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8 flex flex-col items-center justify-center">
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Your plan is being built
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Teacher Vidya is preparing your diagnostic questions. This usually takes a few minutes.
            Your learning plan is saved -- you can return any time to start your assessment.
          </p>

          {notifyState === 'idle' && (
            <button
              type="button"
              onClick={() => sendNotifyRequest(subjectId)}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] transition-all shadow-md shadow-[#534AB7]/25 mb-3"
            >
              Email me when ready
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
            <button
              type="button"
              onClick={() => sendNotifyRequest(subjectId)}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] mb-3 transition-all"
            >
              Try again
            </button>
          )}

          <Link
            href="/dashboard"
            className="inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8 flex flex-col">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#534AB7] flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#534AB7]/30">
            <span className="text-white font-bold text-lg leading-none">S</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            When is your board exam?
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Teacher Vidya will build a plan that covers every chapter in time.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 space-y-5 shadow-sm">
          {/* Exam date input */}
          <div>
            <label
              htmlFor="exam-date"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Exam date
            </label>
            <input
              id="exam-date"
              type="date"
              value={examDateRaw}
              onChange={(e) => setExamDateRaw(e.target.value)}
              placeholder="e.g. 15 March 2027"
              className="w-full min-h-[44px] px-4 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent"
            />
            {dateError && (
              <p className="mt-1 text-xs text-[#E24B4A] dark:text-red-400">{dateError}</p>
            )}
            {hasValidDate && (
              <p className="mt-1 text-xs text-[#1D9E75] dark:text-green-400">
                {parsedDate!.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                · {weeks} {weeks === 1 ? 'week' : 'weeks'} away
              </p>
            )}
          </div>

          {/* Study days per week */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              How many days per week can you study?
            </p>
            <div className="flex gap-2">
              {STUDY_DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setStudyDays(d)}
                  className={[
                    'flex-1 min-h-[44px] rounded-xl border-2 text-sm font-bold transition-all',
                    studyDays === d
                      ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-[#534AB7]/40',
                  ].join(' ')}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 text-center">
              {studyDays} day{studyDays !== 1 ? 's' : ''} / week
            </p>
          </div>

          {/* Live estimate */}
          <div
            className={`rounded-xl px-4 py-3 ${estimate.sufficient ? 'bg-[#EEEDFE] dark:bg-[#534AB7]/10' : 'bg-[#FAEEDA] dark:bg-[#BA7517]/10'}`}
          >
            {!weeks ? (
              // No exam date -- show plan horizon
              <p className="text-sm text-[#534AB7] dark:text-indigo-300 leading-relaxed">
                With <strong>{studyDays} days/week</strong> -- we&apos;ll cover all chapters in{' '}
                <strong>
                  {estimate.weeksToComplete} weeks ({estimate.months} months)
                </strong>{' '}
                with time for{' '}
                <strong>
                  {estimate.revisionRounds} revision round{estimate.revisionRounds !== 1 ? 's' : ''}
                </strong>
                .
              </p>
            ) : estimate.sufficient ? (
              // Exam date set, pace is sufficient
              <p className="text-sm text-[#534AB7] dark:text-indigo-300 leading-relaxed">
                With <strong>{studyDays} days/week</strong> -- you&apos;ll finish all chapters{' '}
                {estimate.spareWeeks > 0 ? (
                  <>
                    with{' '}
                    <strong>
                      {estimate.spareWeeks} week{estimate.spareWeeks !== 1 ? 's' : ''} to spare
                    </strong>{' '}
                    for revision
                  </>
                ) : (
                  <>just in time</>
                )}
                .
              </p>
            ) : (
              // Exam date set, pace is NOT sufficient
              <p className="text-sm text-[#BA7517] dark:text-amber-300 leading-relaxed">
                At <strong>{studyDays} days/week</strong> you&apos;ll need{' '}
                <strong>{estimate.weeksToComplete} weeks</strong> -- but your exam is in{' '}
                <strong>{weeks} weeks</strong>. Study{' '}
                <strong>{estimate.daysNeeded} days/week</strong> to cover all chapters in time.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-xs text-[#E24B4A] dark:text-red-400">
              {error}
            </p>
          )}

          {/* Primary CTA */}
          <button
            type="button"
            onClick={() => generatePlan(true)}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-60 transition-all shadow-md shadow-[#534AB7]/25"
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
                Building your plan...
              </>
            ) : (
              'Build my learning plan →'
            )}
          </button>

          {/* Secondary CTA */}
          <button
            type="button"
            onClick={() => generatePlan(false)}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            No upcoming exam -- set a 6-month plan
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          You can change your exam date later in your profile.
        </p>
      </div>
    </div>
  );
}
