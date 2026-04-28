/**
 * FILE OBJECTIVE:
 * - POST /api/v1/students/[studentId]/progress/topic/[topicId]/complete
 * - Marks topic as completed for the authenticated student and updates mastery floor.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/studentId/progress/topic/topicId/complete/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.2 topic completion endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ studentId: string; topicId: string }>;
}

const COMPLETION_MASTERY_FLOOR = 0.7;

export async function POST(req: Request, { params }: Params) {
  const start = Date.now();
  const { studentId, topicId } = await params;

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'TopicCompleteAPI', methodName: 'POST' }, start);
      return res;
    }

    if (userId !== studentId) {
      const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      logger.logAPI(req, res, { className: 'TopicCompleteAPI', methodName: 'POST' }, start);
      return res;
    }

    const topic = await prisma.topicDef.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        chapter: {
          select: {
            name: true,
            subject: { select: { name: true } },
          },
        },
      },
    });

    if (!topic) {
      const res = NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'TopicCompleteAPI', methodName: 'POST' }, start);
      return res;
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.studentTopicProgress.findUnique({
        where: { studentId_topicId: { studentId: userId, topicId } },
        select: { mastery: true, practiceCount: true },
      });

      const nextMastery = Math.max(existing?.mastery ?? 0, COMPLETION_MASTERY_FLOOR);

      await tx.studentTopicProgress.upsert({
        where: { studentId_topicId: { studentId: userId, topicId } },
        update: {
          mastery: nextMastery,
          lastStudiedAt: new Date(),
        },
        create: {
          studentId: userId,
          topicId,
          mastery: COMPLETION_MASTERY_FLOOR,
          practiceCount: 0,
          lastStudiedAt: new Date(),
        },
      });

      await tx.studentTopicMastery.upsert({
        where: { studentId_topicId: { studentId: userId, topicId } },
        create: {
          studentId: userId,
          topicId,
          subject: topic.chapter.subject.name,
          chapter: topic.chapter.name,
          masteryLevel: 'intermediate',
          accuracy: COMPLETION_MASTERY_FLOOR,
          questionsAttempted: existing?.practiceCount ?? 0,
          lastAttemptedAt: new Date(),
        },
        update: {
          accuracy: { set: COMPLETION_MASTERY_FLOOR },
          masteryLevel: 'intermediate',
          lastAttemptedAt: new Date(),
        },
      });
    });

    const res = NextResponse.json({
      ok: true,
      topicId,
      completedAt: new Date().toISOString(),
    });

    logger.logAPI(req, res, { className: 'TopicCompleteAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('TopicCompleteAPI.error', {
      event: 'topic_complete_failed',
      context: { error: err instanceof Error ? err.message : String(err), topicId, studentId },
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'TopicCompleteAPI', methodName: 'POST' }, start);
    return res;
  }
}
