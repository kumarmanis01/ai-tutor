/**
 * ParentDashboard -- T38
 *
 * One card per linked child. Read-only. Mobile-first.
 * Language: plain, avoids jargon -- written for low-digital-literacy parents.
 *
 * Props shape matches what app/(parent)/dashboard/page.tsx computes.
 */

import SubjectReadinessCard from '@/components/student/dashboard/SubjectReadinessCard'

interface ChildReadiness {
  subjectId: string
  subjectName: string
  score: number
}

interface ChildData {
  studentId: string
  name: string
  grade: string
  board: string
  streak: number
  sessionsThisWeek: number
  readiness: ChildReadiness[]
}

interface ParentDashboardProps {
  children: ChildData[]
}

export default function ParentDashboard({ children }: ParentDashboardProps) {
  // ── Empty state ──────────────────────────────────────────────────────────
  if (children.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-4xl">👨‍👩‍👧</p>
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          No children linked yet
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Ask your child to share an invite link from the Spinzy app,
          then tap it to connect your accounts.
        </p>
        <a
          href="/parent/link-child"
          className="mt-5 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          Link a child
        </a>
      </main>
    )
  }

  // ── Child cards ──────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">
        My children
      </h1>

      {children.map((child) => (
        <section
          key={child.studentId}
          className="rounded-xl border border-gray-200 bg-white px-5 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          {/* ── Header row ─────────────────────────────────────────────── */}
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                {child.name}
              </h2>
              {(child.grade || child.board) && (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {[child.grade, child.board].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <a
              href={`/parent/progress/${child.studentId}`}
              className="shrink-0 rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950"
            >
              View full report
            </a>
          </div>

          {/* ── Stats row ──────────────────────────────────────────────── */}
          <div className="mb-4 flex gap-6">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Sessions this week</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-50">
                {child.sessionsThisWeek}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Study streak</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-50">
                🔥 {child.streak}
              </p>
            </div>
          </div>

          {/* ── Subject readiness ──────────────────────────────────────── */}
          {child.readiness.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Exam readiness by subject
              </p>
              {child.readiness.map((r) => (
                <SubjectReadinessCard
                  key={r.subjectId}
                  subjectName={r.subjectName}
                  score={r.score}
                  subjectId={r.subjectId}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Subjects not set up yet.
            </p>
          )}
        </section>
      ))}
    </main>
  )
}
