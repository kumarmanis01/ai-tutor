/**
 * PrimaryActionCard
 *
 * The single hero card shown at the top of the student dashboard.
 * Renders exactly one of three states based on the student's current context:
 *
 *   'homework'  – Pending/overdue homework exists; must be submitted before
 *                 starting a new session (highest priority).
 *   'resume'    – An in-progress session exists; invite the student to continue.
 *   'start'     – No active session, no pending homework; recommend next topic.
 *
 * This component is the most important UI element on the platform.
 * It must always be visible above the fold. It must never be blank.
 *
 * UX constraints (from architecture review):
 *   - One primary CTA only
 *   - Tutor-toned language ("Your tutor is ready")
 *   - No percentage numbers or jargon
 *   - Mobile-first (min 360px)
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created; replaces TodaysLessonCard +
 *               ResumeSessionCard with unified 3-state card
 */
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  OVERVIEW: 'Reviewing overview',
  EXPLANATION: 'Reading notes',
  PRACTICE: 'Practicing',
  TEST: 'Taking a test',
  HOMEWORK: 'Doing homework',
};

const PHASES = ['OVERVIEW', 'EXPLANATION', 'PRACTICE', 'TEST', 'HOMEWORK'];

interface SessionInfo {
  sessionId: string;
  topicId: string;
  topicName: string;
  currentPhase: string;
  subject: string;
  chapter: string;
  resumePhase?: string;
}

interface RecommendationInfo {
  topicId: string;
  topicTitle: string;
  subject: string;
  chapter?: string;
  estimatedTimeMin: number;
  /** Most recently mastered topic before this one — renders continuity sentence. */
  buildsOnTopicName?: string;
}

interface HomeworkInfo {
  id: string;
  topicName: string;
  questionCount: number;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE';
}

export interface PrimaryActionCardProps {
  type: 'resume' | 'start' | 'homework';
  session?: SessionInfo | null;
  recommendation?: RecommendationInfo | null;
  pendingHomework?: HomeworkInfo | null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PrimaryActionCard({
  type,
  session,
  recommendation,
  pendingHomework,
}: PrimaryActionCardProps) {
  if (type === 'homework' && pendingHomework) {
    return <HomeworkState homework={pendingHomework} />;
  }
  if (type === 'resume' && session) {
    return <ResumeState session={session} />;
  }
  if (type === 'start' && recommendation) {
    return <StartState recommendation={recommendation} />;
  }
  // Fallback: always render something
  return <EmptyStartState />;
}

// ── Resume State ──────────────────────────────────────────────────────────────

function ResumeState({ session }: { session: SessionInfo }) {
  const router = useRouter();
  const phaseIdx = PHASES.indexOf(session.currentPhase);
  const phaseLabel = PHASE_LABELS[session.currentPhase] ?? session.currentPhase;

  return (
    <article className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
        Continue Where You Left Off
      </p>
      <h2 className="mt-1 text-xl font-bold text-gray-900 truncate">{session.topicName}</h2>
      {(session.subject || session.chapter) && (
        <p className="mt-0.5 text-sm text-gray-500">
          {session.subject}
          {session.chapter ? ` · ${session.chapter}` : ''}
        </p>
      )}

      {/* Phase dots */}
      <div className="mt-3 flex items-center gap-1">
        {PHASES.map((p, i) => (
          <div
            key={p}
            title={p.charAt(0) + p.slice(1).toLowerCase()}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i < phaseIdx
                ? 'bg-indigo-500'
                : i === phaseIdx
                ? 'bg-indigo-300'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-indigo-500">{phaseLabel}</p>

      <button
        type="button"
        onClick={() => router.push(`/session/${session.topicId}`)}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 transition-transform"
      >
        Continue Session
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </article>
  );
}

// ── Start State ───────────────────────────────────────────────────────────────

function StartState({ recommendation }: { recommendation: RecommendationInfo }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  function handleStart() {
    setStarting(true);
    // SessionContainer handles POST /api/session/start internally (idempotent).
    router.push(`/session/${recommendation.topicId}`);
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-lg">
      {/* Background decoration */}
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />

      <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">
        Your Tutor is Ready
      </p>

      {(recommendation.subject || recommendation.chapter) && (
        <p className="mt-1 text-sm text-violet-300">
          {recommendation.subject}
          {recommendation.chapter ? ` › ${recommendation.chapter}` : ''}
        </p>
      )}

      <h2 className="mt-1 text-2xl font-bold leading-tight text-white">
        {recommendation.topicTitle}
      </h2>

      {recommendation.buildsOnTopicName && (
        <p className="mt-1.5 text-sm text-violet-300">
          This builds on {recommendation.buildsOnTopicName}, which you completed recently.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {['Explanation', 'Practice', 'Test'].map((step, i) => (
          <span
            key={step}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              {i + 1}
            </span>
            {step}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-violet-600 disabled:opacity-60 active:scale-95 transition-transform"
        >
          {starting ? 'Starting…' : 'Start Lesson'}
          {!starting && (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <p className="text-xs text-violet-300">
          {recommendation.estimatedTimeMin} min
        </p>
      </div>

    </article>
  );
}

// ── Homework State ────────────────────────────────────────────────────────────

function HomeworkState({ homework }: { homework: HomeworkInfo }) {
  const router = useRouter();

  const isOverdue = homework.status === 'OVERDUE';
  const due = new Date(homework.dueDate);
  const now = new Date();
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  const dueLabel =
    isOverdue || diffDays < 0
      ? 'Overdue'
      : diffDays === 0
      ? 'Due today'
      : diffDays === 1
      ? 'Due tomorrow'
      : `Due in ${diffDays} days`;

  return (
    <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Homework Pending
      </p>
      <h2 className="mt-1 text-xl font-bold text-gray-900 truncate">{homework.topicName}</h2>
      <p className="mt-0.5 text-sm text-gray-500">
        {homework.questionCount} question{homework.questionCount !== 1 ? 's' : ''} &nbsp;·&nbsp;
        <span className={isOverdue ? 'text-red-500 font-medium' : 'text-amber-600'}>
          {dueLabel}
        </span>
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Submit your homework from your last session before starting something new.
      </p>
      <button
        type="button"
        onClick={() => router.push(`/homework/${homework.id}`)}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 active:scale-95 transition-transform"
      >
        Complete Homework
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </article>
  );
}

// ── Empty / First-time Start State ────────────────────────────────────────────

// New-user empty state — shown when recommendation is null and no active session
function EmptyStartState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 px-4 py-5">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
        Let&apos;s get you started
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Complete these steps to begin learning with Vidya.
      </p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-green-600">✓</span> Create your account
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-green-600">✓</span> Complete your profile
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-400">
          <span className="text-indigo-500">→</span> Take your diagnostic test
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300 dark:text-gray-600">
          <span>○</span> Start your first session
        </div>
      </div>

      <a
        href="/learn"
        className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-medium text-white"
      >
        Take diagnostic — Mathematics
      </a>
      <p className="mt-2 text-center text-xs text-gray-400">
        ~15 minutes · tells Vidya where to start
      </p>
    </div>
  );
}
