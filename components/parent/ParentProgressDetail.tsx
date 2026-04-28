/**
 * ParentProgressDetail -- T39
 *
 * Read-only. No edit controls, no interaction, no transcript content.
 * Mobile-first, dark variants.
 */

import SubjectReadinessCard from '@/components/student/dashboard/SubjectReadinessCard';
import ActivityHeatmap from '@/components/parent/ActivityHeatmap';

interface SessionRow {
  id: string;
  date: string; // ISO
  topicName: string;
  subjectName: string;
  chapterName: string;
  durationMinutes: number | null;
  completed: boolean;
  topicId?: string;
  masteryAfter?: number | null;
}

interface ReadinessRow {
  subjectId: string;
  subjectName: string;
  score: number;
}

interface ParentProgressDetailProps {
  studentName: string;
  grade: string;
  board: string;
  sessions: SessionRow[];
  readiness: ReadinessRow[];
  heatmapDays?: { date: string; count: number }[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function ParentProgressDetail({
  studentName,
  grade,
  board,
  sessions,
  readiness,
  heatmapDays,
}: ParentProgressDetailProps) {
  const subtitle = [grade, board].filter(Boolean).join(' · ');

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <a
          href="/parent/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm text-[#534AB7] hover:underline dark:text-indigo-400"
        >
          ← My children
        </a>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{studentName}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>

      {/* ── Subject readiness ─────────────────────────────────────────── */}
      {readiness.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-400">
            Exam readiness by subject
          </h2>
          <div className="space-y-2">
            {readiness.map((r) => (
              <SubjectReadinessCard
                key={r.subjectId}
                subjectName={r.subjectName}
                score={r.score}
                subjectId={r.subjectId}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Activity heatmap (30 days) ─────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-400">
          Activity -- last 30 days
        </h2>
        {heatmapDays && heatmapDays.length > 0 ? (
          <ActivityHeatmap days={heatmapDays} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No activity in the last 30 days.
          </p>
        )}
      </section>

      {/* ── Last 10 sessions ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-400">
          Last 10 sessions
        </h2>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No sessions in the last 7 days.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900">
            {sessions.map((s) => {
              const mastery = s.masteryAfter ?? null;
              const masteryLabel =
                mastery === null
                  ? null
                  : mastery >= 0.7
                    ? 'Positive'
                    : mastery >= 0.4
                      ? 'Neutral'
                      : 'Needs revision';
              const masteryClasses =
                mastery === null
                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  : mastery >= 0.7
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : mastery >= 0.4
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
              return (
                <div key={s.id} className="flex items-start justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
                      {s.topicName || '--'}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {[s.subjectName, s.chapterName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(s.date)}</p>
                    {s.durationMinutes !== null && (
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                        {s.durationMinutes} min
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-2">
                      {s.completed && (
                        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                          Done
                        </span>
                      )}
                      {masteryLabel && (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${masteryClasses}`}
                        >
                          {masteryLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
