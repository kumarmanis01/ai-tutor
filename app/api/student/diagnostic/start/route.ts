import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { generateSubjectDiagnosticTest } from '@/lib/diagnostics/diagnosticQuestionService';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/diagnostics/sessionStore';
import { upsertSubjectDiagnosticStatus, getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore';
import { enqueueDiagnosticAutoSubmit } from '@/jobs/diagnosticAutoSubmit';

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
    const res = NextResponse.json({ error: 'boardSlug, grade and subjectSlug are required' }, { status: 400 });
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
          { status: 429 },
        );
        logger.logAPI(req, res, { className: 'DiagnosticStartAPI', methodName: 'POST' }, start);
        return res;
      }
      // If eligible for retake, attempt to avoid reusing the same question set.
      try {
        const prevRunId = existingStatus.runId;
        if (prevRunId) {
          const prev = await prisma.answerEvent.findMany({ where: { studentId: user.id, sessionId: prevRunId }, select: { questionId: true } });
          const prevIds = new Set(prev.map((p) => p.questionId).filter(Boolean));
          if (prevIds.size > 0) {
            // Regenerate test excluding previously-seen question IDs to ensure a different set.
            test = await generateSubjectDiagnosticTest({ boardSlug, grade, subjectSlug, languageCode }, prevIds);
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
    logger.warn('diagnostic.start failed', { error: String(err) })
    const res = NextResponse.json({ error: 'Failed to start diagnostic' }, { status: 500 });
    logger.logAPI(req, res, { className: 'DiagnosticStartAPI', methodName: 'POST' }, start);
    return res;
  }
}
