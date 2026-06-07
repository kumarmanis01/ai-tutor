/**
 * GET /api/student/diagnostic/check-ready?subjectId={id}
 *
 * Lightweight readiness check for DiagnosticWaitingScreen polling.
 * Called every 5 s by the client -- no DB writes, three COUNT queries only.
 * All question counts use relation filters (topic -> chapter -> subjectId) so
 * no intermediate ID fetch is required.
 *
 * Response: { ready: boolean, phase: "topics" | "questions" | "ready" }
 *   phase "topics"    -- syllabus pipeline has not completed (no TopicDef rows)
 *   phase "questions" -- topics exist but question bank is still empty
 *   phase "ready"     -- both present; client should navigate to the diagnostic
 *
 * Auth: session required -- 401 if missing.
 * See: docs/v2/on-demand-generator.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use req.url (always present) rather than req.nextUrl so the handler is
  // testable with a plain Request, not just NextRequest.
  const subjectId = new URL(req.url).searchParams.get('subjectId');
  if (!subjectId || typeof subjectId !== 'string') {
    return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
  }

  try {
    const topicCount = await prisma.topicDef.count({
      where: {
        chapter: { subjectId, lifecycle: 'active' },
        lifecycle: 'active',
      },
    });

    if (topicCount === 0) {
      return NextResponse.json({ ready: false, phase: 'topics' });
    }

    // Use relation filters in both count queries to avoid a separate findMany
    // for topic IDs -- three COUNT queries total, no intermediate data fetch.
    const qCount = await prisma.question.count({
      where: {
        status: 'ACTIVE',
        topic: { lifecycle: 'active', chapter: { lifecycle: 'active', subjectId } },
      },
    });

    if (qCount > 0) {
      return NextResponse.json({ ready: true, phase: 'ready' });
    }

    const gqCount = await prisma.generatedQuestion.count({
      where: {
        test: {
          lifecycle: 'active',
          topic: { lifecycle: 'active', chapter: { lifecycle: 'active', subjectId } },
        },
      },
    });

    if (gqCount > 0) {
      return NextResponse.json({ ready: true, phase: 'ready' });
    }

    return NextResponse.json({ ready: false, phase: 'questions' });
  } catch (err) {
    logger.error('[check-ready] readiness check failed', {
      event: 'diagnostic.check_ready.error',
      context: { studentId: userId, subjectId, error: String(err) },
    });
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
