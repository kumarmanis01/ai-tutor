/**
 * /student/revisions — Revision Cards page (v2 Screen 13)
 *
 * Server component:
 * 1. Checks auth — redirects to /login if unauthenticated.
 * 2. Fetches concepts due for revision (nextReviewAt <= now).
 * 3. For each concept, fetches up to 3 MCQ questions via topicId.
 * 4. If 0 due: shows empty state.
 * 5. If due > 0: renders RevisionFlow (client component).
 */

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import RevisionFlow, { type RevisionCard } from '@/components/student/revision/RevisionFlow'

const MAX_CARDS = 20
const QUESTIONS_PER_CONCEPT = 3

export const dynamic = 'force-dynamic'

export default async function RevisionsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const userId = (session.user as { id: string }).id

  const now = new Date()

  // 1. Fetch due concepts
  const dueConcepts = await prisma.studentConceptState.findMany({
    where: { studentId: userId, nextReviewAt: { lte: now } },
    orderBy: { nextReviewAt: 'asc' },
    take: MAX_CARDS,
    select: {
      conceptId: true,
      concept: {
        select: {
          id: true,
          name: true,
          topicId: true,
          subject: { select: { name: true } },
        },
      },
    },
  })

  // 2. If nothing is due: empty state
  if (dueConcepts.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No revision due today
          </h1>
          <p className="text-sm text-[#1D9E75] font-medium mb-6">
            You&apos;re all caught up — well done!
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold px-6 min-h-[44px] hover:bg-[#4840a3] transition-colors"
          >
            Browse subjects
          </Link>
        </div>
      </main>
    )
  }

  // 3. Fetch MCQ questions for each due concept (via topicId)
  const topicIds = [...new Set(dueConcepts.map((d) => d.concept.topicId))]

  const questions = topicIds.length > 0
    ? await prisma.question.findMany({
        where: {
          topicId: { in: topicIds },
          type: 'mcq',
          choices: { not: undefined },
          correctAnswer: { not: null },
        },
        select: {
          id: true,
          topicId: true,
          prompt: true,
          choices: true,
          correctAnswer: true,
        },
      })
    : []

  // Group questions by topicId for quick lookup
  const questionsByTopic = new Map<string, typeof questions>()
  for (const q of questions) {
    if (!q.topicId) continue
    if (!questionsByTopic.has(q.topicId)) questionsByTopic.set(q.topicId, [])
    const list = questionsByTopic.get(q.topicId)!
    if (list.length < QUESTIONS_PER_CONCEPT) list.push(q)
  }

  // 4. Build RevisionCard array — only concepts that have at least one question
  const cards: RevisionCard[] = []
  for (const d of dueConcepts) {
    const topicQs = questionsByTopic.get(d.concept.topicId) ?? []
    for (const q of topicQs) {
      let choices: string[]
      try {
        choices = Array.isArray(q.choices) ? (q.choices as string[]) : JSON.parse(String(q.choices))
      } catch {
        continue
      }
      if (!Array.isArray(choices) || choices.length === 0) continue
      if (!q.correctAnswer) continue
      cards.push({
        conceptId: d.conceptId,
        conceptName: d.concept.name,
        subjectName: d.concept.subject.name,
        questionId: q.id,
        prompt: q.prompt,
        choices,
        correctAnswer: q.correctAnswer,
      })
    }
  }

  // If no usable questions were found, fall back to empty state
  if (cards.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No revision due today
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Questions are being prepared — check back soon.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold px-6 min-h-[44px] hover:bg-[#4840a3] transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    )
  }

  return <RevisionFlow cards={cards} totalDue={dueConcepts.length} />
}
