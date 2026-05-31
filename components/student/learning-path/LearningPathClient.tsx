/**
 * FILE OBJECTIVE:
 * - Interactive client-side view of the student's week-by-week learning timeline.
 * - F-STU-003: renders the personalised timeline immediately after onboarding.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/learning-path/page.test.tsx
 *
 * EDIT LOG:
 * - 2026-05-23T00:00:00Z | claude | created for F-STU-003 learning path page
 */
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { TimelineResponse, TimelineWeek, TimelineItem } from '@/lib/student/learningPlanTimeline';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  data: TimelineResponse;
  isFirstVisit: boolean;
}

type MasteryBand = 'green' | 'amber' | 'red' | 'default';

interface ChapterGroup {
  chapterId: string;
  chapterName: string;
  items: TimelineItem[];
  sessionCount: number;
  isMandatory: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BAND_BG: Record<MasteryBand, string> = {
  green: 'bg-[#EAF3DE] border-[#1D9E75]/30',
  amber: 'bg-[#FAEEDA] border-[#BA7517]/30',
  red: 'bg-[#FCEBEB] border-[#E24B4A]/30',
  default: 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700',
};

const BAND_TEXT: Record<MasteryBand, string> = {
  green: 'text-[#1D9E75]',
  amber: 'text-[#BA7517]',
  red: 'text-[#E24B4A]',
  default: 'text-gray-500 dark:text-gray-400',
};

const BAND_LABELS: Record<MasteryBand, string> = {
  green: 'Strong',
  amber: 'In Progress',
  red: 'Needs Attention',
  default: 'Upcoming',
};

const BAND_FILL_COLOR: Record<MasteryBand, string> = {
  green: '#1D9E75',
  amber: '#BA7517',
  red: '#E24B4A',
  default: '#534AB7',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveBand(items: TimelineItem[]): MasteryBand {
  if (items.length === 0) return 'default';
  if (items.every((i) => i.status === 'COMPLETED')) return 'green';
  if (items.some((i) => i.status === 'IN_PROGRESS')) return 'amber';
  if (items.some((i) => i.status === 'DEFERRED')) return 'red';
  return 'default';
}

function groupByChapter(week: TimelineWeek): ChapterGroup[] {
  const map = new Map<string, ChapterGroup>();
  for (const item of week.items) {
    const existing = map.get(item.chapterId);
    if (existing) {
      existing.items.push(item);
      if (item.isMandatory) existing.isMandatory = true;
    } else {
      map.set(item.chapterId, {
        chapterId: item.chapterId,
        chapterName: item.chapterName,
        items: [item],
        sessionCount: 0,
        isMandatory: item.isMandatory,
      });
    }
  }
  for (const cs of week.chapterSummary) {
    for (const [, group] of map) {
      if (group.chapterName === cs.chapterName) {
        group.sessionCount = cs.sessionCount;
      }
    }
  }
  return Array.from(map.values());
}

function formatWeekDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Chapter Card ──────────────────────────────────────────────────────────────

interface ChapterCardProps {
  chapter: ChapterGroup;
  subjectName: string;
  chapterIndex: number;
  totalChapters: number;
  onReorder: (itemId: string, direction: 'prev' | 'next') => Promise<void>;
}

function ChapterCard({ chapter, subjectName, chapterIndex, totalChapters, onReorder }: ChapterCardProps) {
  const [moving, setMoving] = useState(false);
  const band = deriveBand(chapter.items);
  const completed = chapter.items.filter((i) => i.status === 'COMPLETED').length;
  const total = chapter.items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isAllCompleted = completed === total && total > 0;
  const canReorder = !chapter.isMandatory && !isAllCompleted;

  const representativeItem = chapter.items.find(
    (i) => i.status === 'UPCOMING' || i.status === 'IN_PROGRESS',
  );
  const sessionCount = chapter.sessionCount || total;

  async function handleMove(direction: 'prev' | 'next') {
    if (!representativeItem || moving) return;
    setMoving(true);
    try {
      await onReorder(representativeItem.id, direction);
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className={`rounded-xl border p-4 ${BAND_BG[band]}`}>
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {chapter.chapterName}
            </span>
            {chapter.isMandatory && (
              <span aria-label="Mandatory chapter" title="Mandatory chapter">
                🔒
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs text-gray-500 dark:text-gray-400">
            <span>{subjectName}</span>
            <span aria-hidden>·</span>
            <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${BAND_BG[band]} ${BAND_TEXT[band]}`}>
            {BAND_LABELS[band]}
          </span>

          {/* Reorder controls -- hidden for mandatory and completed chapters */}
          {canReorder && (
            <div className="flex flex-col gap-0.5 ml-1">
              <button
                type="button"
                aria-label={`Move ${chapter.chapterName} earlier`}
                disabled={chapterIndex === 0 || moving}
                onClick={() => handleMove('prev')}
                className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
              >
                {moving ? '...' : '↑'}
              </button>
              <button
                type="button"
                aria-label={`Move ${chapter.chapterName} later`}
                disabled={chapterIndex >= totalChapters - 1 || moving}
                onClick={() => handleMove('next')}
                className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
              >
                {moving ? '...' : '↓'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mastery progress bar */}
      <div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: BAND_FILL_COLOR[band] }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 text-right">
          {completed}/{total} done
        </p>
      </div>
    </div>
  );
}

// ── Week Panel ────────────────────────────────────────────────────────────────

interface WeekPanelProps {
  week: TimelineWeek;
  subjectName: string;
  isCurrentWeek: boolean;
  onReorder: (itemId: string, direction: 'prev' | 'next') => Promise<void>;
}

function WeekPanel({ week, subjectName, isCurrentWeek, onReorder }: WeekPanelProps) {
  const [expanded, setExpanded] = useState(isCurrentWeek);
  const chapters = groupByChapter(week);

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        isCurrentWeek
          ? 'border-[#534AB7]/30 dark:border-[#534AB7]/40'
          : 'border-gray-200 dark:border-slate-700'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 min-h-[48px] text-left transition-colors ${
          isCurrentWeek
            ? 'bg-[#EEEDFE] dark:bg-[#534AB7]/10'
            : 'bg-white dark:bg-slate-800'
        }`}
      >
        <div>
          <span
            className={`text-xs font-semibold uppercase tracking-wide ${
              isCurrentWeek ? 'text-[#534AB7]' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {isCurrentWeek ? 'Current week' : `Week ${week.weekNumber}`}
          </span>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            From {formatWeekDate(week.startDate)} &middot; {week.items.length} session
            {week.items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
          {chapters.map((chapter, idx) => (
            <ChapterCard
              key={chapter.chapterId}
              chapter={chapter}
              subjectName={subjectName}
              chapterIndex={idx}
              totalChapters={chapters.length}
              onReorder={onReorder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Exam countdown banner ─────────────────────────────────────────────────────

function ExamCountdownBanner({ daysToExam }: { daysToExam: number }) {
  const isCrunch = daysToExam <= 14;
  const isAmber = !isCrunch && daysToExam <= 30;

  const bgClass = isCrunch
    ? 'bg-[#FCEBEB] dark:bg-[#E24B4A]/10 border-[#E24B4A]/20'
    : isAmber
    ? 'bg-[#FAEEDA] dark:bg-[#BA7517]/10 border-[#BA7517]/20'
    : 'bg-[#EEEDFE] dark:bg-[#534AB7]/10 border-[#534AB7]/20';

  const textClass = isCrunch
    ? 'text-[#E24B4A]'
    : isAmber
    ? 'text-[#BA7517]'
    : 'text-[#534AB7] dark:text-indigo-300';

  const label = isCrunch ? 'Crunch Mode -- exam very soon!' : `${daysToExam} days to exam`;

  return (
    <div className={`rounded-xl border px-4 py-3 mb-5 flex items-center gap-3 ${bgClass}`}>
      <span className={`text-3xl font-extrabold font-mono leading-none ${textClass}`} aria-hidden>
        {daysToExam}d
      </span>
      <p className={`text-sm font-semibold ${textClass}`}>{label}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LearningPathClient({ data, isFirstVisit }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [recalcStatus, setRecalcStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const currentWeekNumber =
    data.weeks.find((w) =>
      w.items.some((i) => i.status === 'UPCOMING' || i.status === 'IN_PROGRESS'),
    )?.weekNumber ?? null;

  const daysToExam =
    data.examDate
      ? Math.ceil((new Date(data.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

  async function handleReorder(itemId: string, direction: 'prev' | 'next') {
    const res = await fetch(`/api/student/learning-plan/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', direction }),
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  async function handleRecalculate() {
    if (recalcStatus === 'loading') return;
    setRecalcStatus('loading');
    try {
      const res = await fetch('/api/student/learning-plan/adjust', { method: 'POST' });
      if (res.ok) {
        setRecalcStatus('success');
        startTransition(() => router.refresh());
      } else {
        setRecalcStatus('error');
      }
    } catch {
      setRecalcStatus('error');
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
      {/* Back link + heading */}
      <div className="mb-5">
        <Link
          href="/student/dashboard"
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 mb-1 transition-colors"
        >
          &larr; Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Learning Path</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {data.subjectName} &middot; {data.totalWeeks} week{data.totalWeeks !== 1 ? 's' : ''} &middot;{' '}
          {data.weeklyGoal} sessions/week
        </p>
      </div>

      {/* Welcome banner (first visit after onboarding) */}
      {isFirstVisit && !welcomeDismissed && (
        <div className="rounded-xl border border-[#534AB7]/30 bg-[#EEEDFE] dark:bg-[#534AB7]/10 px-4 py-3 mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#534AB7] dark:text-indigo-300">
              Your personalised learning path is ready -- Weak chapters come first. Tap any week to expand.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWelcomeDismissed(true)}
            aria-label="Dismiss welcome message"
            className="shrink-0 text-[#534AB7]/60 hover:text-[#534AB7] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      {/* Exam countdown */}
      {daysToExam !== null && daysToExam > 0 && (
        <ExamCountdownBanner daysToExam={daysToExam} />
      )}

      {/* Overall progress bar */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Overall progress</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {data.completedConcepts}/{data.totalConcepts} sessions
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-[#534AB7] transition-all duration-300"
            style={{
              width: `${data.totalConcepts > 0 ? Math.round((data.completedConcepts / data.totalConcepts) * 100) : 0}%`,
            }}
            role="progressbar"
            aria-valuenow={data.totalConcepts > 0 ? Math.round((data.completedConcepts / data.totalConcepts) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Week panels */}
      <div className="space-y-4 mb-6">
        {data.weeks.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-sm">Your plan is being prepared...</p>
            <p className="text-xs mt-1">Check back in a moment.</p>
          </div>
        ) : (
          data.weeks.map((week) => (
            <WeekPanel
              key={week.weekNumber}
              week={week}
              subjectName={data.subjectName}
              isCurrentWeek={week.weekNumber === currentWeekNumber}
              onReorder={handleReorder}
            />
          ))
        )}
      </div>

      {/* Recalculate Plan button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRecalculate}
          disabled={recalcStatus === 'loading'}
          className="inline-flex items-center min-h-[44px] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 px-4 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors"
        >
          {recalcStatus === 'loading' ? 'Recalculating...' : 'Recalculate Plan'}
        </button>
        {recalcStatus === 'success' && (
          <span className="text-sm text-[#1D9E75] dark:text-green-400">Plan updated!</span>
        )}
        {recalcStatus === 'error' && (
          <span className="text-sm text-[#E24B4A] dark:text-red-400">Could not update -- tap to retry</span>
        )}
      </div>
    </main>
  );
}
