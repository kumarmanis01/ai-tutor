/**
 * FILE OBJECTIVE:
 * - API endpoint for tracking and retrieving student topic completion status.
 *   Supports marking topics as read/completed and fetching progress.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/progress/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for MVP topic completion tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/progress
 * Query params: subject?, chapter?, topicId?
 * Returns topic mastery records for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  let res: Response;
  
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  
  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'ProgressAPI', methodName: 'GET' }, start);
    return res;
  }

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject');
  const chapter = searchParams.get('chapter');
  const topicId = searchParams.get('topicId');

  const where: any = { studentId: user.id };
  if (subject) where.subject = subject;
  if (chapter) where.chapter = chapter;
  if (topicId) where.topicId = topicId;

  const progress = await prisma.studentTopicMastery.findMany({
    where,
    orderBy: { lastAttemptedAt: 'desc' },
  });

  // Transform to a more usable format
  const result = progress.map((p) => ({
    topicId: p.topicId,
    subject: p.subject,
    chapter: p.chapter,
    masteryLevel: p.masteryLevel,
    accuracy: p.accuracy,
    questionsAttempted: p.questionsAttempted,
    lastAttemptedAt: p.lastAttemptedAt?.toISOString(),
    isCompleted: p.masteryLevel === 'expert' || p.masteryLevel === 'advanced',
    isStarted: true, // record exists → user has interacted with this topic
  }));

  res = NextResponse.json({ progress: result });
  logger.logAPI(req, res, { className: 'ProgressAPI', methodName: 'GET' }, start);
  return res;
}

/**
 * POST /api/progress
 * Body: { topicId, subject?, chapter?, action: 'view' | 'complete' | 'attempt' }
 * Records topic interaction for the authenticated user.
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  let res: Response;
  
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  
  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'ProgressAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.topicId) {
    res = NextResponse.json({ error: 'topicId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'ProgressAPI', methodName: 'POST' }, start);
    return res;
  }

  const { topicId, subject, chapter, action = 'view' } = body;

  // Find or create the mastery record
  let mastery = await prisma.studentTopicMastery.findFirst({
    where: { studentId: user.id, topicId },
  });

  if (!mastery) {
    mastery = await prisma.studentTopicMastery.create({
      data: {
        studentId: user.id,
        topicId,
        subject: subject || null,
        chapter: chapter || null,
        masteryLevel: action === 'complete' ? 'advanced' : 'beginner',
        accuracy: 0,
        questionsAttempted: 0,
        lastAttemptedAt: new Date(),
      },
    });
  } else {
    // Update last attempted timestamp
    const updateData: any = { lastAttemptedAt: new Date() };
    
    // If action is 'complete', mark as proficient if not already mastered
    if (action === 'complete' && mastery.masteryLevel !== 'expert') {
      updateData.masteryLevel = 'advanced';
    }
    
    mastery = await prisma.studentTopicMastery.update({
      where: { id: mastery.id },
      data: updateData,
    });
  }

  res = NextResponse.json({
    success: true,
    mastery: {
      topicId: mastery.topicId,
      masteryLevel: mastery.masteryLevel,
      accuracy: mastery.accuracy,
      questionsAttempted: mastery.questionsAttempted,
      lastAttemptedAt: mastery.lastAttemptedAt?.toISOString(),
      isCompleted: mastery.masteryLevel === 'expert' || mastery.masteryLevel === 'advanced',
    },
  });
  
  logger.logAPI(req, res, { className: 'ProgressAPI', methodName: 'POST' }, start);
  return res;
}
