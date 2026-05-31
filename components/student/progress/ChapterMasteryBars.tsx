/**
 * FILE OBJECTIVE:
 * - Render the per-subject chapter mastery breakdown with accessible rows,
 *   mastery bars, and board-weight indicators.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/progress/ChapterMasteryBars.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 * - 2026-05-10T00:00:00Z | copilot | remove inline styles, add estimated-weight label, and improve row accessibility
 */

import Link from 'next/link';

export interface ChapterRow {
  chapterId: string;
  chapterName: string;
  /** 0-1 float */
  masteryScore: number;
  /** chapter weight as % of total exam marks */
  boardWeightPct: number;
  /** source of the displayed board weight */
  weightSource: 'board' | 'estimated';
  /** conceptId for the lowest-mastery concept in this chapter, or null */
  weakestConceptId: string | null;
  /** Average memory strength for the chapter (0-1) */
  memoryStrength?: number;
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
  if (mastery100 > 70) return { barClass: 'bg-[#1D9E75]', text: 'text-[#1D9E75]' };
  if (mastery100 >= 40) return { barClass: 'bg-[#BA7517]', text: 'text-[#BA7517]' };
  return { barClass: 'bg-[#E24B4A]', text: 'text-[#E24B4A]' };
}

function percentWidthClass(percent: number): string {
  const rounded = Math.max(0, Math.min(100, Math.round(percent / 5) * 5));
  return `w-pct-${rounded}`;
}

function ChapterRowLink({ chapter }: { chapter: ChapterRow }) {
  const mastery100 = Math.round(chapter.masteryScore * 100);
  const { barClass, text } = chapterColor(mastery100);
  const href = chapter.weakestConceptId
    ? `/session/pre/${chapter.weakestConceptId}`
    : null;

  const content = (
    <>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate pr-2">
            {chapter.chapterName}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`${text} text-xs font-semibold`}>
              {mastery100}%
            </span>
            {chapter.weightSource === 'estimated' && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-[#BA7517] bg-[#FAEEDA] dark:bg-[#BA7517]/15 px-1.5 py-0.5 rounded-full">
                est.
              </span>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-600 overflow-hidden" aria-hidden="true">
          <div
            className={`h-full rounded-full ${percentWidthClass(mastery100)} ${barClass}`}
          />
        </div>
        <div className="mt-2">
          <div className="h-1 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
            <div
              className={`h-full rounded-full ${percentWidthClass(Math.round((chapter.memoryStrength ?? 0) * 100))} bg-[#534AB7]`}
            />
          </div>
        </div>
      </div>
      <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
        {chapter.boardWeightPct.toFixed(0)}%
      </span>
    </>
  );

  const rowClassName = 'flex items-center gap-3 py-3 min-h-[44px] border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/40 rounded-lg px-1 transition-colors';

  if (!href) {
    return (
      <div className={rowClassName} aria-label={`${chapter.chapterName}: ${mastery100}% mastery`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={rowClassName}
      aria-label={`${chapter.chapterName}: ${mastery100}% mastery -- tap to practise`}
    >
      {content}
    </Link>
  );
}

export default function ChapterMasteryBars({ subjects }: ChapterMasteryBarsProps) {
  const panelClass = 'bg-white dark:bg-slate-900 border border-[#D3D1C7] dark:border-slate-700 rounded-2xl p-5';

  if (subjects.length === 0) {
    return (
      <article className={panelClass}>
        <p className="text-sm text-[#888780] dark:text-gray-400 mb-3">
          No chapter data yet -- complete a session to start tracking your mastery.
        </p>
        <Link
          href="/student/dashboard"
          className="inline-flex items-center min-h-[44px] text-sm font-medium text-[#534AB7] dark:text-[#9B96E0] underline"
        >
          Start your first session →
        </Link>
      </article>
    );
  }

  return (
    <article className={panelClass}>
      <p className="text-[11px] text-[#888780] dark:text-gray-500 mb-4">
        Tap a chapter to practise -- lowest mastery first
      </p>

      {subjects.map((subject) => (
        <section key={subject.subjectId} className="mb-5 last:mb-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#888780] dark:text-gray-400 mb-2">
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
