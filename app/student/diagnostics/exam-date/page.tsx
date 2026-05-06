'use client';

/**
 * FILE OBJECTIVE:
 * - Exam date capture shown after all enrolled subjects' diagnostics are complete.
 * - Student picks their board exam date or opts out ("no exam in next 2 months").
 * - Study days per week selector (3-7) + live coverage estimate.
 * - Calls POST /api/student/onboarding/generate-plan, then redirects to results.
 *
 * EDIT LOG:
 * - 2026-05-06 | claude | created for diagnostics-status-screen task
 */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Constants ──────────────────────────────────────────────────────────────────

const STUDY_DAY_OPTIONS = [3, 4, 5, 6, 7];
const DEFAULT_STUDY_DAYS = 5;
const TOTAL_CONCEPTS = 60;

// ── Helpers ────────────────────────────────────────────────────────────────────

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

interface Estimate {
  weeksToComplete: number;
  months: string;
  revisionRounds: number;
  sufficient: boolean;
  spareWeeks: number;
  daysNeeded: number;
}

function computeEstimate(daysPerWeek: number, weeksUntilExam: number | null): Estimate {
  const weeksToComplete = Math.ceil(TOTAL_CONCEPTS / daysPerWeek);
  const totalSessions = weeksToComplete * daysPerWeek;
  const revisionRounds = Math.max(1, Math.floor((totalSessions - TOTAL_CONCEPTS) / (TOTAL_CONCEPTS / 3)));
  const months = (weeksToComplete / 4.33).toFixed(1);

  if (weeksUntilExam === null) {
    return { weeksToComplete, months, revisionRounds, sufficient: true, spareWeeks: 0, daysNeeded: 0 };
  }
  if (weeksUntilExam >= weeksToComplete) {
    return { weeksToComplete, months, revisionRounds, sufficient: true, spareWeeks: weeksUntilExam - weeksToComplete, daysNeeded: 0 };
  }
  return { weeksToComplete, months, revisionRounds: 0, sufficient: false, spareWeeks: 0, daysNeeded: Math.ceil(TOTAL_CONCEPTS / weeksUntilExam) };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ExamDatePage() {
  const router = useRouter();

  const [examDateRaw, setExamDateRaw] = useState('');
  const [studyDays, setStudyDays] = useState(DEFAULT_STUDY_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const parsedDate = useMemo(() => parseExamDate(examDateRaw), [examDateRaw]);
  const weeks = useMemo(() => weeksUntil(parsedDate), [parsedDate]);
  const estimate = useMemo(() => computeEstimate(studyDays, weeks), [studyDays, weeks]);

  const hasValidDate = parsedDate !== null;
  const dateError = examDateRaw.trim() && !hasValidDate ? 'Please select a future date.' : '';

  async function submitPlan(withExamDate: boolean) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/student/onboarding/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate: withExamDate && parsedDate ? parsedDate.toISOString() : null,
          studyDaysPerWeek: studyDays,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      router.push('/student/diagnostics/results');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8 flex flex-col">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center gap-6">

        {/* Header */}
        <div>
          <div className="w-12 h-12 rounded-xl bg-[#534AB7] flex items-center justify-center mb-4 shadow-md shadow-[#534AB7]/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            When is your board exam?
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Vidya will build a plan that covers every chapter with time to revise.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 space-y-5 shadow-sm">

          {/* Date input */}
          <div>
            <label htmlFor="exam-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Exam date
            </label>
            <input
              id="exam-date"
              type="date"
              value={examDateRaw}
              onChange={(e) => setExamDateRaw(e.target.value)}
              className="w-full min-h-[44px] px-4 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent"
            />
            {dateError && <p className="mt-1 text-xs text-[#E24B4A]">{dateError}</p>}
            {hasValidDate && parsedDate && (
              <p className="mt-1 text-xs text-[#1D9E75] dark:text-green-400">
                {parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' '}
                &middot; {weeks} {weeks === 1 ? 'week' : 'weeks'} away
              </p>
            )}
          </div>

          {/* Study days selector */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Days per week you can study
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
              {studyDays} {studyDays === 1 ? 'day' : 'days'} per week
            </p>
          </div>

          {/* Live estimate */}
          <div className={`rounded-xl px-4 py-3 ${estimate.sufficient ? 'bg-[#EEEDFE] dark:bg-[#534AB7]/10' : 'bg-[#FAEEDA] dark:bg-[#BA7517]/10'}`}>
            {!weeks ? (
              <p className="text-sm text-[#534AB7] dark:text-indigo-300 leading-relaxed">
                With <strong>{studyDays} days/week</strong> you will cover all chapters in{' '}
                <strong>{estimate.weeksToComplete} weeks ({estimate.months} months)</strong> with{' '}
                <strong>{estimate.revisionRounds} revision round{estimate.revisionRounds !== 1 ? 's' : ''}</strong>.
              </p>
            ) : estimate.sufficient ? (
              <p className="text-sm text-[#534AB7] dark:text-indigo-300 leading-relaxed">
                With <strong>{studyDays} days/week</strong> you will finish all chapters{' '}
                {estimate.spareWeeks > 0
                  ? <>with <strong>{estimate.spareWeeks} {estimate.spareWeeks === 1 ? 'week' : 'weeks'} to spare</strong> for revision</>
                  : <>just in time</>}.
              </p>
            ) : (
              <p className="text-sm text-[#BA7517] dark:text-amber-300 leading-relaxed">
                At <strong>{studyDays} days/week</strong> you need <strong>{estimate.weeksToComplete} weeks</strong>{' '}
                but your exam is in <strong>{weeks} weeks</strong>. Study{' '}
                <strong>{estimate.daysNeeded} days/week</strong> to cover everything in time.
              </p>
            )}
          </div>

          {error && <p role="alert" className="text-xs text-[#E24B4A]">{error}</p>}

          {/* Primary CTA */}
          <button
            type="button"
            onClick={() => submitPlan(true)}
            disabled={busy}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-60 transition-all shadow-md shadow-[#534AB7]/25"
          >
            {busy ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden />
                Building your plan...
              </>
            ) : (
              'Build my learning plan'
            )}
          </button>

          {/* Secondary CTA */}
          <button
            type="button"
            onClick={() => submitPlan(false)}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            No exam in next 2 months
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          You can update your exam date later from your profile.
        </p>
      </div>
    </div>
  );
}
