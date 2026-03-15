/**
 * ParentProgressDetail — T39
 *
 * Read-only. No edit controls, no interaction, no transcript content.
 * Mobile-first, dark variants.
 */

import SubjectReadinessCard from '@/components/student/dashboard/SubjectReadinessCard'

interface SessionRow {
  id: string
  date: string        // ISO
  topicName: string
  subjectName: string
  chapterName: string
  durationMinutes: number | null
  completed: boolean
}

interface ReadinessRow {
  subjectId: string
  subjectName: string
  score: number
}

interface ParentProgressDetailProps {
  studentName: string
  grade: string
  board: string
  sessions: SessionRow[]
  readiness: ReadinessRow[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function ParentProgressDetail({
  studentName,
  grade,
  board,
  sessions,
  readiness,
}: ParentProgressDetailProps) {
  const subtitle = [grade, board].filter(Boolean).join(' · ')

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <a
          href="/parent/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← My children
        </a>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{studentName}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
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

      {/* ── Sessions last 7 days ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-400">
          Sessions — last 7 days
        </h2>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No sessions in the last 7 days.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-start justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
                    {s.topicName || '—'}
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
                  {s.completed && (
                    <span className="mt-0.5 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                      Done
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  )
}
