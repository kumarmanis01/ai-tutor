import { NextResponse } from 'next/server'
/**
 * FILE OBJECTIVE:
 * - GET /api/student/surprise-me: returns a single concept recommendation for the
 *   "Surprise me" CTA on the student dashboard.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/surprise-me/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-06T00:00:00Z | copilot | fix: resolve TopicDef.id to first non-suspended
 *                          Concept.id in both code paths so navigation to
 *                          /session/pre/[conceptId] succeeds instead of silently
 *                          redirecting back to /dashboard
 */

import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getOrderedTopicsForStudent } from '@/lib/homeEngine/getOrderedTopicsForStudent'
import { rankTopics } from '@/lib/recommendations/topicRanker'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/student/surprise-me
 *
 * Returns a single suggestion selected by the "Surprise me" action.
 * Primary intent: pick the student's highest-priority weak topic (mastery < 0.4,
 * practiceCount > 5). If none found, fallback to the TopicRanker top result.
 */
export async function GET(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start)
    return res
  }

  try {
    // 1. Try to pick the most urgent weak topic (mastery < 0.4 & practiceCount > 5)
    const weak = await prisma.studentTopicProgress.findFirst({
      where: { studentId: userId, mastery: { lt: 0.4 }, practiceCount: { gt: 5 } },
      orderBy: [{ mastery: 'asc' }, { practiceCount: 'desc' }],
      include: {
        topic: {
          include: { chapter: { include: { subject: true } } },
        },
      },
    })

    if (weak) {
      const topic = weak.topic
      // Resolve TopicDef.id → first non-suspended Concept.id.
      // The pre-session page expects a Concept.id; passing a TopicDef.id
      // causes prisma.concept.findUnique to miss and silently redirect to /dashboard.
      const weakConcept = await prisma.concept.findFirst({
        where: { topicId: topic.id, isSuspended: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (!weakConcept) {
        // Topic has no teachable concepts yet -- fall through to ranker fallback
      } else {
        const action = {
          topicId: weakConcept.id,
          topicName: topic.name,
          subject: topic.chapter?.subject?.name ?? null,
          chapter: topic.chapter?.name ?? null,
          ruleId: 'surprise_me',
          reasonLabel: `Try strengthening ${topic.name}`,
          actionType: 'practice',
        }
        const res = NextResponse.json({ action, source: 'surprise_me' }, { status: 200 })
        logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start)
        return res
      }
    }

    // 2. Fallback: use TopicRanker (similar to P5 in getNextAction)
    const ordered = await getOrderedTopicsForStudent(userId)
    const scored = await rankTopics(userId, { preloadedOrderedTopics: ordered })
    const best = scored?.[0]
    if (best) {
      const bestConcept = await prisma.concept.findFirst({
        where: { topicId: best.topicId, isSuspended: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (bestConcept) {
        const action = {
          topicId: bestConcept.id,
          topicName: best.topicName,
          subject: best.subjectName,
          chapter: best.chapterName,
          ruleId: 'surprise_me_fallback',
          reasonLabel: `Try ${best.topicName}`,
          actionType: 'notes',
        }
        const res = NextResponse.json({ action, source: 'surprise_me' }, { status: 200 })
        logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start)
        return res
      }
    }

    const res = NextResponse.json({ action: null, source: 'surprise_me' }, { status: 204 })
    logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    logger.error('[surprise-me] error', { userId, error: String((err as any)?.message ?? err) })
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'SurpriseMeAPI', methodName: 'GET' }, start)
    return res
  }
}
