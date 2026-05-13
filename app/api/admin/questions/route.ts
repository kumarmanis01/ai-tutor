/**
 * FILE OBJECTIVE:
 * - Return the admin question review queue, defaulting to flagged questions that are pending review or quarantined.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/questions/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | default the admin question queue to pending review and include latest flag details for moderation
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { QuestionStatus } from '@prisma/client'

const DEFAULT_REVIEW_STATUSES = [QuestionStatus.PENDING_REVIEW, QuestionStatus.QUARANTINED]
const VALID_STATUSES = new Set<string>(Object.values(QuestionStatus))

function parseRequestedStatuses(rawStatus: string | null): QuestionStatus[] {
  if (!rawStatus) {
    return DEFAULT_REVIEW_STATUSES
  }

  const requestedStatuses = rawStatus
    .split(',')
    .map((status) => status.trim())
    .filter((status): status is QuestionStatus => VALID_STATUSES.has(status))

  return requestedStatuses.length > 0 ? requestedStatuses : DEFAULT_REVIEW_STATUSES
}

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const statuses = parseRequestedStatuses(req.nextUrl.searchParams.get('status'))

  const questions = await prisma.question.findMany({
    where: { status: { in: statuses } },
    include: {
      sessionFlags: {
        select: {
          id: true,
          reason: true,
          details: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
      topic: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ questions })
}
