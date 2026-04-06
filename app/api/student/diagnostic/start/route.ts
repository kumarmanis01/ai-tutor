import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { generateSubjectDiagnosticTest } from '@/lib/diagnostics/diagnosticQuestionService';
import { createSession } from '@/lib/diagnostics/sessionStore';

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
    const test = await generateSubjectDiagnosticTest({ boardSlug, grade, subjectSlug, languageCode });
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
    const res = NextResponse.json({ error: 'Failed to start diagnostic' }, { status: 500 });
    logger.logAPI(req, res, { className: 'DiagnosticStartAPI', methodName: 'POST' }, start);
    return res;
  }
}
