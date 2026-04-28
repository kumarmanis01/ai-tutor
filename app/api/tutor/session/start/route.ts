import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { checkFreeTierCap, incrementFreeTierUsage } from '@/lib/freemium';
import { isInAITutorRollout } from '@/lib/features/rollout';
import { hasDiagnosticForSubject } from '@/lib/student/diagnosticGuard';
import { prisma } from '@/lib/prisma';
import { setTutorSession } from '@/lib/redis/tutorSession';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  conceptId: z.string().min(1),
  subjectId: z.string().min(1),
});

export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session as any)?.user?.id as string | undefined;

    if (!userId) {
      res = NextResponse.json({ error: 'Unauthorized', code: 'LOGIN_REQUIRED' }, { status: 401 });
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
      return res;
    }

    // Rollout gate: kill switch -> per-user flag -> percentage hash
    if (!(await isInAITutorRollout(userId))) {
      res = NextResponse.json(
        { error: 'AI Tutor is not enabled for your account.', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
      return res;
    }

    const rawBody = await req.json().catch(() => null);
    const parseResult = bodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      res = NextResponse.json(
        { error: 'Invalid request body', code: 'BAD_REQUEST' },
        { status: 400 }
      );
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
      return res;
    }

    const { conceptId, subjectId } = parseResult.data;

    // F-ADM-013 AC-04: concept suspension gate -- admin can suspend a concept from AI
    // teaching when a hallucination is confirmed. Block the session start so students
    // see a clear message rather than a mid-session error.
    const conceptCheck = await prisma.concept.findUnique({
      where: { id: conceptId },
      select: { isSuspended: true, prerequisiteConceptIds: true },
    });
    if (conceptCheck?.isSuspended) {
      res = NextResponse.json(
        {
          error:
            'This topic is currently under review. Please try a different topic or check back soon.',
          code: 'CONCEPT_SUSPENDED',
        },
        { status: 503 }
      );
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
      return res;
    }

    // F-ADM-002 AC-05: subject availability gate -- admin can disable a subject.
    const subjectCheck = await prisma.subjectDef.findUnique({
      where: { id: subjectId },
      select: { isAvailable: true },
    });
    if (subjectCheck && !subjectCheck.isAvailable) {
      res = NextResponse.json(
        {
          error: 'This subject is not currently available. Please check back soon.',
          code: 'SUBJECT_UNAVAILABLE',
        },
        { status: 503 }
      );
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
      return res;
    }

    // Diagnostic gate -- student must have completed the IRT bootstrap for this subject.
    const hasDiag = await hasDiagnosticForSubject(userId, subjectId);
    if (!hasDiag) {
      res = NextResponse.json({ code: 'DIAGNOSTIC_REQUIRED', subjectId }, { status: 403 });
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
      return res;
    }

    // Free tier enforcement -- never throws.
    const freeTierUsage = await checkFreeTierCap(userId);
    if (!freeTierUsage.allowed) {
      res = NextResponse.json(
        {
          error: 'Free tier session cap reached.',
          code: 'SESSION_CAP_REACHED',
          freeTierUsage,
        },
        { status: 402 }
      );
      logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
      return res;
    }

    // Fetch pre-session mastery, prereq concept names, and prereq mastery scores concurrently.
    const prerequisiteConceptIds = conceptCheck?.prerequisiteConceptIds ?? [];
    // Intentionally allow Prisma errors to propagate to the outer try/catch so
    // the request fails fast if DB queries are failing rather than creating a
    // session with partial or misleading metadata.
    const [conceptStateResult, prereqConceptsResult, prereqStatesResult] = await Promise.all([
      prisma.studentConceptState.findUnique({
        where: { studentId_conceptId: { studentId: userId, conceptId } },
        select: { masteryScore: true },
      }),
      prerequisiteConceptIds.length > 0
        ? prisma.concept.findMany({
            where: { id: { in: prerequisiteConceptIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
      prerequisiteConceptIds.length > 0
        ? prisma.studentConceptState.findMany({
            where: { studentId: userId, conceptId: { in: prerequisiteConceptIds } },
            select: { conceptId: true, masteryScore: true },
          })
        : Promise.resolve([] as { conceptId: string; masteryScore: number }[]),
    ]);

    const preSessionMastery: number | null = conceptStateResult?.masteryScore ?? null;

    // Build enriched prereq objects so the client can show per-prereq mastery status.
    const prereqMasteryMap = new Map(prereqStatesResult.map((s) => [s.conceptId, s.masteryScore]));
    const prereqs = prereqConceptsResult.map((c) => ({
      conceptId: c.id,
      name: c.name,
      masteryScore: prereqMasteryMap.get(c.id) ?? null,
    }));

    // A prereq with no StudentConceptState (null) or masteryScore < 0.5 is considered unmet.
    // Unmet prereqs cause the session to start in PREREQ_BRIDGE so Vidya bridges the gap first.
    const hasUnmetPrereqs = prereqs.some((p) => (p.masteryScore ?? 0) < 0.5);
    const initialStage = hasUnmetPrereqs ? 'PREREQ_BRIDGE' : 'HOOK';

    // Generate a unique session ID and persist a LearningSession record so the
    // completion handler can accurately compute masteryDelta and sessionDuration.
    const sessionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `tutor_${Date.now().toString(36)}`;

    await prisma.learningSession.create({
      data: {
        id: sessionId,
        studentId: userId,
        activityType: 'tutor',
        activityRef: conceptId,
        difficultyLevel: 'medium',
        meta: { conceptId, preSessionMastery, hintsUsed: 0, initialStage },
      },
    });

    // Seed the Redis session state so the first turn handler finds the correct starting
    // stage without an extra DB round-trip. Redis failure is non-blocking.
    await setTutorSession(sessionId, {
      sessionId,
      stage: initialStage,
      hintsRemaining: 3,
      lastTurnNumber: 0,
      stageAttemptCount: 0,
      consecutiveWrongAnswers: 0,
      prereqRemediationActive: hasUnmetPrereqs,
      prereqReturnStage: hasUnmetPrereqs ? 'CORE_EXPLANATION' : null,
      lastTurnCompleted: true,
    });

    // Resume context: check Redis for an in-progress turn on this (newly created) session.
    const resumeContext = {
      hasIncompleteSession: false,
      lastStage: initialStage,
    };

    // Only increment after session is successfully persisted.
    await incrementFreeTierUsage(userId);

    res = NextResponse.json({
      sessionId,
      resumeContext,
      prereqs,
      freeTierUsage,
    });

    // AC-04: session must load within 3 s on 4G -- log a warning when the API
    // handler itself exceeds that threshold so slow paths surface in logs.
    const elapsed = Date.now() - start;
    if (elapsed > 3000) {
      logger.warn('TutorSessionStartAPI: slow response', {
        event: 'session_start_slow',
        context: { userId, elapsedMs: elapsed, thresholdMs: 3000 },
      });
    }

    logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    const formatted = formatErrorForResponse(err);
    res = NextResponse.json({ error: formatted, code: 'INTERNAL_ERROR' }, { status: 500 });
    logger.logAPI(req, res, { className: 'TutorSessionStartAPI', methodName: 'POST' }, start);
    return res;
  }
}
