'use client';

/**
 * TodaysLearningCard -- v2
 *
 * Replaces PrimaryActionCard. Rendered with server-fetched props from
 * app/(student)/dashboard/page.tsx (no client-side fetch).
 *
 * Visual spec:
 *   - Purple left border accent: border-l-4 border-[#534AB7]
 *   - Subject badge: purple pill
 *   - Duration chip: grey pill
 *   - CTA: full-width "Start today's session" → /student/session/[conceptId]
 *
 * States:
 *   - 'start'    -- learning plan item available
 *   - 'resume'   -- active in-progress session
 *   - 'homework' -- pending homework must be done first
 *   - 'ahead'    -- plan exists but no item this week
 *   - 'empty'    -- no plan + no diagnostic taken yet (onboarding checklist)
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from '@/lib/toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TodaysLearningCardRecommendation {
  conceptId: string;
  topicTitle: string;
  subject: string;
  estimatedTimeMin: number;
  weekNumber?: number;
  // If present, this ties the recommendation back to a concrete LearningPlanItem
  planItemId?: string;
}

export interface TodaysLearningCardSession {
  sessionId: string;
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  currentPhase: string;
}

export interface TodaysLearningCardHomework {
  id: string;
  topicName: string;
  questionCount: number;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE';
}

export interface TodaysLearningCardProps {
  type: 'start' | 'resume' | 'homework' | 'ahead' | 'empty' | 'plan_loading';
  recommendation?: TodaysLearningCardRecommendation | null;
  session?: TodaysLearningCardSession | null;
  homework?: TodaysLearningCardHomework | null;
  // href for the "Take diagnostic test" CTA shown in the empty/onboarding state.
  // Should be /diagnostic/[firstSubjectId]. Defaults to /dashboard if not provided.
  diagnosticHref?: string;
  // Override the primary CTA label (e.g. "Study for exam" in crunch mode).
  ctaLabel?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TodaysLearningCard({
  type,
  recommendation,
  session,
  homework,
  diagnosticHref,
  ctaLabel,
}: TodaysLearningCardProps) {
  if (type === 'resume' && session) return <ResumeState session={session} />;
  if (type === 'homework' && homework) return <HomeworkState homework={homework} />;
  if (type === 'start' && recommendation) return <StartState rec={recommendation} ctaLabel={ctaLabel} />;
  if (type === 'ahead') return <AheadState />;
  if (type === 'plan_loading') return <PlanLoadingState />;
  return <EmptyState diagnosticHref={diagnosticHref ?? '/dashboard'} />;
}

// ── Start state ───────────────────────────────────────────────────────────────

function StartState({ rec, ctaLabel }: { rec: TodaysLearningCardRecommendation; ctaLabel?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);

  function handleStart() {
    setLoading(true);
    router.push(`/session/pre/${encodeURIComponent(rec.conceptId)}`);
  }

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 border-l-4 border-l-[#534AB7] overflow-hidden shadow-sm">
      <div className="p-5">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {rec.subject && (
            <span className="inline-flex items-center rounded-full bg-[#534AB7]/10 dark:bg-[#534AB7]/20 px-3 py-1 text-xs font-semibold text-[#534AB7] dark:text-indigo-300">
              {rec.subject}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
            {rec.estimatedTimeMin} min
          </span>
          {rec.weekNumber && (
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              Week {rec.weekNumber}
            </span>
          )}
          {rec.planItemId && (
            <div className="ml-auto inline-flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  if (moving) return;
                  setMoving(true);
                  try {
                    const res = await fetch(`/api/student/learning-plan/${encodeURIComponent(rec.planItemId)}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'move', direction: 'prev' }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json?.error || 'Move failed');
                    // refresh server props
                    router.refresh();
                  } catch (err: any) {
                    toast(String(err?.message || 'Could not move earlier'));
                  } finally {
                    setMoving(false);
                  }
                }}
                aria-label="Move earlier in week"
                disabled={moving}
                className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (moving) return;
                  setMoving(true);
                  try {
                    const res = await fetch(`/api/student/learning-plan/${encodeURIComponent(rec.planItemId)}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'move', direction: 'next' }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json?.error || 'Move failed');
                    router.refresh();
                  } catch (err: any) {
                    toast(String(err?.message || 'Could not move later'));
                  } finally {
                    setMoving(false);
                  }
                }}
                aria-label="Move later in week"
                disabled={moving}
                className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                ▼
              </button>
            </div>
          )}
        </div>

        {/* Topic name */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-5">
          {rec.topicTitle}
        </h2>

        {/* CTA */}
        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          className="w-full min-h-[44px] rounded-xl bg-[#534AB7] hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-60 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-[#534AB7]/25"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Starting...
            </>
          ) : (
            <>
              {ctaLabel ?? "Start today's session"}
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </>
          )}
        </button>
      </div>
    </article>
  );
}

// ── Resume state ──────────────────────────────────────────────────────────────

function ResumeState({ session }: { session: TodaysLearningCardSession }) {
  const router = useRouter();

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 border-l-4 border-l-[#534AB7] overflow-hidden shadow-sm">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center rounded-full bg-[#534AB7]/10 dark:bg-[#534AB7]/20 px-3 py-1 text-xs font-semibold text-[#534AB7] dark:text-indigo-300">
            {session.subject}
          </span>
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            In progress
          </span>
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-5">
          {session.topicName}
        </h2>

        <button
          type="button"
          onClick={() => router.push(`/session/${session.topicId}`)}
          className="w-full min-h-[44px] rounded-xl bg-[#534AB7] hover:bg-[#4840a3] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-[#534AB7]/25"
        >
          Continue session
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </article>
  );
}

// ── Homework state ────────────────────────────────────────────────────────────

function HomeworkState({ homework }: { homework: TodaysLearningCardHomework }) {
  const router = useRouter();
  const isOverdue = homework.status === 'OVERDUE';
  const due = new Date(homework.dueDate);
  const diffDays = Math.round((due.getTime() - Date.now()) / 86_400_000);
  const dueLabel =
    isOverdue || diffDays < 0 ? 'Overdue'
    : diffDays === 0 ? 'Due today'
    : diffDays === 1 ? 'Due tomorrow'
    : `Due in ${diffDays} days`;

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 border-l-4 border-l-[#BA7517] overflow-hidden shadow-sm">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            Homework pending
          </span>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${isOverdue ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>
            {dueLabel}
          </span>
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1">
          {homework.topicName}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {homework.questionCount} question{homework.questionCount !== 1 ? 's' : ''}
        </p>

        <button
          type="button"
          onClick={() => router.push(`/homework/${homework.id}`)}
          className="w-full min-h-[44px] rounded-xl bg-[#BA7517] hover:bg-amber-700 active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
        >
          Complete homework
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </article>
  );
}

// ── Ahead-of-plan state ───────────────────────────────────────────────────────

function AheadState() {
  return (
    <article className="rounded-2xl border border-[#1D9E75]/30 dark:border-[#1D9E75]/20 bg-[#1D9E75]/5 dark:bg-[#1D9E75]/10 border-l-4 border-l-[#1D9E75] overflow-hidden">
      <div className="p-5">
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          You&apos;re ahead of your plan this week! 🎉
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          All topics for this week are done. Take a well-earned rest or explore something new.
        </p>
        <Link
          href="/learn/learning-path"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-[#1D9E75] text-[#1D9E75] dark:text-[#1D9E75] px-5 text-sm font-semibold hover:bg-[#1D9E75]/10 transition-colors"
        >
          Explore topics →
        </Link>
      </div>
    </article>
  );
}

// ── Plan loading state (diagnostic complete, bootstrap job in progress) ────────

function PlanLoadingState() {
  return (
    <article className="rounded-2xl border border-[#534AB7]/20 dark:border-[#534AB7]/30 bg-[#EEEDFE] dark:bg-[#534AB7]/10 border-l-4 border-l-[#534AB7] overflow-hidden">
      <div className="p-5">
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Great work completing your diagnostic!
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Teacher Vidya is building your personalised learning plan. It will be ready in moments -- refresh to see your first session.
        </p>
        <Link
          href="/learn/learning-path"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-[#534AB7] text-[#534AB7] dark:text-indigo-300 px-5 text-sm font-semibold hover:bg-[#534AB7]/10 transition-colors"
        >
          Explore topics →
        </Link>
      </div>
    </article>
  );
}

// ── Empty / onboarding state ──────────────────────────────────────────────────

function EmptyState({ diagnosticHref }: { diagnosticHref: string }) {
  return (
    <article className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 border-l-4 border-l-[#534AB7] overflow-hidden">
      <div className="p-5">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Let&apos;s get you started
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Complete these steps to begin learning with Teacher Vidya.
        </p>

        <ol className="space-y-2 mb-5">
          {[
            { done: true, label: 'Create your account' },
            { done: true, label: 'Complete your profile' },
            { done: false, label: 'Take your diagnostic test', active: true },
            { done: false, label: 'Start your first session' },
          ].map((step) => (
            <li key={step.label} className="flex items-center gap-2 text-sm">
              {step.done ? (
                <span className="text-[#1D9E75]" aria-hidden>✓</span>
              ) : step.active ? (
                <span className="text-[#534AB7]" aria-hidden>→</span>
              ) : (
                <span className="text-gray-300 dark:text-gray-600" aria-hidden>○</span>
              )}
              <span className={step.active ? 'font-medium text-[#534AB7] dark:text-indigo-400' : step.done ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        <Link
          href={diagnosticHref}
          className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] transition-colors"
        >
          Take diagnostic test
        </Link>
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
          ~15 minutes · tells Teacher Vidya where to start
        </p>
      </div>
    </article>
  );
}
