/**
 * ChapterMasteryBars — per-subject, per-chapter mastery progress bars.
 *
 * Chapters are ordered lowest mastery first (most needs attention at top).
 * Each row links to /session/pre/[weakestConceptId] for targeted practice.
 * Board chapter weight is shown as a grey chip.
 *
 * Colour rules (from CLAUDE.md):
 *   >70% mastery → green  (#1D9E75)
 *   40–70%       → amber  (#BA7517)
 *   <40%         → red    (#E24B4A)
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 */

import Link from 'next/link';

export interface ChapterRow {
  chapterId: string;
  chapterName: string;
  /** 0–1 float */
  masteryScore: number;
  /** chapter weight as % of total exam marks */
  boardWeightPct: number;
  /** conceptId for the lowest-mastery concept in this chapter, or null */
  weakestConceptId: string | null;
}

export interface SubjectMasteryData {
  subjectId: string;
  subjectName: string;
  /** sorted ascending by masteryScore (lowest first) */
  chapters: ChapterRow[];
}

interface ChapterMasteryBarsProps {
  subjects: SubjectMasteryData[];
}

function chapterColor(mastery100: number) {
  if (mastery100 > 70) return { bar: '#1D9E75', text: 'text-[#1D9E75]' };
  if (mastery100 >= 40) return { bar: '#BA7517', text: 'text-[#BA7517]' };
  return { bar: '#E24B4A', text: 'text-[#E24B4A]' };
}

function ChapterRowLink({ chapter }: { chapter: ChapterRow }) {
  const mastery100 = Math.round(chapter.masteryScore * 100);
  const { bar, text } = chapterColor(mastery100);
  const href = chapter.weakestConceptId
    ? `/session/pre/${chapter.weakestConceptId}`
    : '#';

  return (
    <a
      href={href}
      className="flex items-center gap-3 py-3 min-h-[44px] border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/40 rounded-lg px-1 transition-colors"
      aria-label={`${chapter.chapterName}: ${mastery100}% mastery — tap to practise`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate pr-2">
            {chapter.chapterName}
          </span>
          <span className={`${text} text-xs font-semibold flex-shrink-0`}>
            {mastery100}%
          </span>
        </div>
        <div
          className="h-2 rounded-full bg-gray-100 dark:bg-slate-600 overflow-hidden"
          role="progressbar"
          aria-valuenow={mastery100}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${mastery100}%`, backgroundColor: bar }}
          />
        </div>
      </div>
      <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
        {chapter.boardWeightPct.toFixed(0)}%
      </span>
    </a>
  );
}

export default function ChapterMasteryBars({ subjects }: ChapterMasteryBarsProps) {
  if (subjects.length === 0) {
    return (
      <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
          Chapter mastery
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          No chapter data yet — complete a session to start tracking your mastery.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center min-h-[44px] text-sm font-medium text-[#534AB7] dark:text-[#9B96E0] underline"
        >
          Start your first session →
        </Link>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
        Chapter mastery
      </h2>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-4">
        Tap a chapter to practise — lowest mastery first
      </p>

      {subjects.map((subject) => (
        <section key={subject.subjectId} className="mb-5 last:mb-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            {subject.subjectName}
          </h3>

          {subject.chapters.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
              No chapters available yet
            </p>
          ) : (
            <div>
              {subject.chapters.map((ch) => (
                <ChapterRowLink key={ch.chapterId} chapter={ch} />
              ))}
            </div>
          )}
        </section>
      ))}
    </article>
  );
}
