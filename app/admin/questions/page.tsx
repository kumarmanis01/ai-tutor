/**
 * FILE OBJECTIVE:
 * - Admin page for reviewing flagged and quarantined questions with detail modal and approve/reject actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/questions/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | default the review page to pending-review questions and surface the latest flag reason details
 * - 2026-05-13T00:00:00Z | copilot | refactor to use QuestionsReviewTable component with rich detail modal showing all student flags and question content
 */

import { Suspense } from 'react'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { QuestionsReviewTable } from './QuestionsReviewTable'
import { QuestionStatus } from '@prisma/client'

async function QuestionsContent() {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    redirect('/dashboard')
  }

  const questions = await prisma.question.findMany({
    where: { status: { in: [QuestionStatus.PENDING_REVIEW, QuestionStatus.QUARANTINED] } },
    include: {
      sessionFlags: {
        select: {
          id: true,
          reason: true,
          details: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      topic: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Flagged Question Review Queue
        </h1>
        <p className="text-[12px] text-gray-500">
          Review student-flagged questions and approve or reject them from the queue.
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900 p-4">
          <p className="text-[13px] text-green-700 dark:text-green-300 font-medium">
            No flagged questions waiting for review — queue is clean! ✓
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          <QuestionsReviewTable questions={questions} />
        </div>
      )}
    </div>
  )
}

export default function QuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <p className="text-gray-500">Loading questions...</p>
        </div>
      }
    >
      <QuestionsContent />
    </Suspense>
  )
}
