/**
 * FILE OBJECTIVE:
 * - Server page that renders a compact diagnostic summary showing one readiness
 *   card per selected subject (used when all diagnostics are complete).
 *
 * LINKED UNIT TEST:
 * - tests/unit/diagnostic/summary.page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-30T00:00:00Z | staff-engineer | add comprehensive diagnostic summary page
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore'
import { SubjectReadinessCard } from '@/components/student/dashboard/SubjectReadinessCard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Diagnostics -- Summary',
  description: 'Overview of diagnostics across your selected subjects',
}

export default async function DiagnosticSummaryPage({
  searchParams,
}: {
  searchParams: { subjects?: string }
}) {
  const authSession = await requireActiveSession()
  if (!authSession) redirect('/')

  const userId = (authSession.user as { id: string }).id
  const params = await searchParams
  const idsParam = (params?.subjects ?? '').trim()
  if (!idsParam) redirect('/dashboard')

  const subjectIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
  if (subjectIds.length === 0) redirect('/dashboard')

  const subjects = await prisma.subjectDef.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true },
  })

  // For each subject compute readiness and diagnostic status (safe fallbacks)
  const rows = await Promise.all(
    subjects.map(async (s) => {
      const [result, diagStatus] = await Promise.all([
        computeReadinessScore(userId, s.id).catch(() => ({ score: 0 })),
        getSubjectDiagnosticStatus(userId, s.id).catch(() => null),
      ])
      return {
        subjectId: s.id,
        subjectName: s.name,
        score: (result as any).score ?? 0,
        predictedRange: (result as any).predictedRange ?? undefined,
        diagnosticDone: diagStatus?.status === 'completed',
        retakeEligibleAt: diagStatus?.retakeEligibleAt ?? null,
      }
    }),
  )

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Diagnostics -- Your results</h1>
        <p className="text-sm text-gray-600 mt-1">Review readiness for each subject you selected.</p>
      </div>

      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.subjectId}>
            <Link href={`/diagnostic/${r.subjectId}`} className="block">
              <SubjectReadinessCard
                subjectId={r.subjectId}
                subjectName={r.subjectName}
                score={r.score}
                diagnosticDone={r.diagnosticDone}
                predictedRange={r.predictedRange}
                retakeEligibleAt={r.retakeEligibleAt}
              />
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link
          href="/student/onboarding/exam-date"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-[#534AB7] text-white text-sm font-medium hover:bg-[#4840a3]"
        >
          Start learning →
        </Link>
      </div>
    </main>
  )
}
