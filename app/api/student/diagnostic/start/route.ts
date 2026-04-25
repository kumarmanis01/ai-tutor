/**
 * FILE OBJECTIVE:
 * - Start a subject diagnostic for a student: generate questions, persist a session
 *   placeholder, mark status `in_progress`, and schedule auto-submit.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/diagnostic/start/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created
 * - 2026-04-22T09:20:00Z | staff-engineer | emit `diagnostic_started` analytics event on session start
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { generateSubjectDiagnosticTest } from '@/lib/diagnostics/diagnosticQuestionService';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/diagnostics/sessionStore';
import {
  upsertSubjectDiagnosticStatus,
  getSubjectDiagnosticStatus,
} from '@/lib/diagnostics/stateStore';
import { enqueueDiagnosticAutoSubmit } from '@/jobs/diagnosticAutoSubmit';
import { getAnalyticsQueue } from '@/lib/queues/analyticsQueue';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'DiagnosticStartAPI', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const { boardSlug, grade, subjectSlug, languageCode } = body ?? {};
  if (!boardSlug || !grade || !subjectSlug) {
    const res = NextResponse.json(
      { error: 'boardSlug, grade and subjectSlug are required' },
      { status: 400 }
    );
    logger.logAPI(req, res, { className: 'DiagnosticStartAPI', methodName: 'POST' }, start);
    return res;
  }

  try {
    // AC-08: enforce 30-day retake cooldown -- resolve subjectId via slug before checking.
    // We first generate a test to resolve the canonical subjectId for the state-store lookup.
    let test = await generateSubjectDiagnosticTest({ boardSlug, grade, subjectSlug, languageCode });

    const existingStatus = await getSubjectDiagnosticStatus(user.id, test.subjectId);
    if (existingStatus.status === 'completed' && existingStatus.completedAt) {
      const completedMs = new Date(existingStatus.completedAt).getTime();
      const cooldownMs = 30 * 24 * 60 * 60 * 1000; // 30 days
      const eligibleAt = new Date(completedMs + cooldownMs);
      if (Date.now() < eligibleAt.getTime()) {
        const res = NextResponse.json(
          {
            code: 'RETAKE_COOLDOWN',
            message: 'Diagnostic retake is available 30 days after completion.',
            eligibleAt: eligibleAt.toISOString(),
          },
          { status: 429 }
        );
        logger.logAPI(req, res, { className: 'DiagnosticStartAPI', methodName: 'POST' }, start);
        return res;
      }
      // If eligible for retake, attempt to avoid reusing the same question set.
      try {
        const prevRunId = existingStatus.runId;
        if (prevRunId) {
          const prev = await prisma.answerEvent.findMany({
            where: { studentId: user.id, sessionId: prevRunId },
            select: { questionId: true },
          });
          const prevIds = new Set(prev.map((p) => p.questionId).filter(Boolean));
          if (prevIds.size > 0) {
            // Regenerate test excluding previously-seen question IDs to ensure a different set.
            test = await generateSubjectDiagnosticTest(
              { boardSlug, grade, subjectSlug, languageCode },
              prevIds
            );
          }
        }
      } catch (e) {
        logger.warn('diagnostic.start: failed to exclude previous questions', { error: String(e) });
      }
    }
    const sessionId = `sess:${user.id}:${subjectSlug}:${Date.now()}`;

    // Persist session with candidate pool (IDs)
    const candidateQuestionIds = test.questions.map((q) => q.id);
    await createSession(sessionId, {
      sessionId,
      userId: user.id,
      subjectId: test.subjectId,
      subjectName: test.subjectName,
      boardSlug,
      grade: Number(grade),
      candidateQuestionIds,
      administered: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Transition diagnostic status to in_progress so the mandatory gate reflects active session.
    await upsertSubjectDiagnosticStatus(user.id, test.subjectId, {
      status: 'in_progress',
      runId: sessionId,
    });

    // AC-07: schedule 24h auto-submit at session start so partial diagnostics are always
    // submitted even if the student never explicitly saves and closes the browser.
    await enqueueDiagnosticAutoSubmit({ userId: user.id, subjectId: test.subjectId, sessionId });

    // Analytics: emit `diagnostic_started` for ingestion (best-effort, non-blocking).
    try {
      const analyticsQueue = getAnalyticsQueue();
      const metadata = {
        subjectId: test.subjectId,
        subjectName: test.subjectName ?? null,
        boardSlug: boardSlug ?? null,
        grade: Number(grade),
        sessionId,
        totalQuestions: candidateQuestionIds.length,
      } as const;

      const analyticsEventData = {
        eventType: 'diagnostic_started',
        userId: user.id,
        courseId: null,
        lessonIdx: null,
        metadata,
      } as const;

      if (analyticsQueue) {
        try {
          // Job name follows analytics ingestion convention used elsewhere
          await analyticsQueue.add('analytics.ingest', analyticsEventData);
        } catch (enqueueErr) {
          logger.warn(
            'diagnostic.start: analytics enqueue failed; falling back to direct DB write',
            {
              className: 'DiagnosticStartAPI',
              methodName: 'POST',
              error: String(enqueueErr),
            }
          );
          try {
            await prisma.analyticsEvent.create({ data: analyticsEventData });
          } catch (dbErr) {
            logger.warn('diagnostic.start: analytics fallback DB write failed', {
              className: 'DiagnosticStartAPI',
              methodName: 'POST',
              error: String(dbErr),
            });
          }
        }
      } else {
        try {
          // Fallback: write directly to DB (best-effort)
          await prisma.analyticsEvent.create({ data: analyticsEventData });
        } catch (dbErr) {
          logger.warn('diagnostic.start: analytics DB write failed', {
            className: 'DiagnosticStartAPI',
            methodName: 'POST',
            error: String(dbErr),
          });
        }
      }
    } catch (analyticsErr) {
      // Isolate analytics failures from user flow; log the issue (logger handles serialization).
      logger.warn('diagnostic.start: analytics emit failed', {
        className: 'DiagnosticStartAPI',
        methodName: 'POST',
        error: String(analyticsErr),
      });
    }

    const first = test.questions[0];
    const payload = {
      sessionId,
      firstQuestion: first
        ? {
            id: first.id,
            prompt: first.questionText,
            options: first.options,
            difficulty: first.difficulty,
            topicId: first.topicId,
          }
        : null,
      totalQuestions: candidateQuestionIds.length,
    };

    const res = NextResponse.json(payload);
    logger.logAPI(req, res, { className: 'DiagnosticStartAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.warn('diagnostic.start failed', { error: String(err) });
    const res = NextResponse.json({ error: 'Failed to start diagnostic' }, { status: 500 });
    logger.logAPI(req, res, { className: 'DiagnosticStartAPI', methodName: 'POST' }, start);
    return res;
  }
}
