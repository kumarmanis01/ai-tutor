/**
 * FILE OBJECTIVE:
 * - Persist S1.3 quick onboarding diagnostic outcomes (score + placement) on student profile.
 *   Moved from [id]/diagnostic-result to [studentId]/diagnostic-result to resolve ambiguous
 *   route build error (both [id] and [studentId] matched the same URL pattern).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/[id]/diagnostic-result/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created POST endpoint to store quick-diagnostic result and placement
 * - 2026-04-27T13:45:00Z | copilot | require authenticated student identity and enforce token-subject match before updates
 * - 2026-04-27T00:00:00Z | copilot | moved from [id] to [studentId] to fix ambiguous route build error
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyUserAccessToken } from '@/lib/auth/token.service';
import { sendMailSafe } from '@/lib/mailer';
import { diagnosticSummaryEmailHtml } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

type PlacementLevel = 'FOUNDATION' | 'STANDARD' | 'ADVANCED';

const bodySchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedAnswer: z.string().min(1),
      })
    )
    .min(1)
    .max(5),
});

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

function scoreToPlacement(score: number): PlacementLevel {
  if (score >= 4) return 'ADVANCED';
  if (score >= 2) return 'STANDARD';
  return 'FOUNDATION';
}

function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

async function isAuthorizedStudentWrite(req: Request, studentId: string): Promise<boolean> {
  const token = readBearerToken(req);
  if (!token) {
    return false;
  }

  // Backward-compatible fallback token shape used by onboarding response.
  if (token === `full:${studentId}`) {
    return true;
  }

  if (token.startsWith('explore:')) {
    const consentToken = token.slice('explore:'.length).trim();
    if (!consentToken) {
      return false;
    }
    const consentRequest = await prisma.consentRequest.findUnique({
      where: { token: consentToken },
      select: { studentId: true },
    });
    return consentRequest?.studentId === studentId;
  }

  try {
    const payload = await verifyUserAccessToken(token);
    return payload.scope === 'user' && payload.sub === studentId;
  } catch {
    return false;
  }
}

export async function POST(req: Request, context: RouteContext) {
  const start = Date.now();
  const { studentId } = await context.params;

  if (!studentId) {
    const response = NextResponse.json({ error: 'missing_student_id' }, { status: 400 });
    logger.logAPI(
      req,
      response,
      { className: 'QuickDiagnosticResultAPI', methodName: 'POST' },
      start
    );
    return response;
  }

  const isAuthorized = await isAuthorizedStudentWrite(req, studentId);
  if (!isAuthorized) {
    const response = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    logger.logAPI(
      req,
      response,
      { className: 'QuickDiagnosticResultAPI', methodName: 'POST' },
      start
    );
    return response;
  }

  try {
    const jsonBody = (await req.json()) as unknown;
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      const response = NextResponse.json({ error: 'validation_error' }, { status: 400 });
      logger.logAPI(
        req,
        response,
        { className: 'QuickDiagnosticResultAPI', methodName: 'POST' },
        start
      );
      return response;
    }

    const answerMap = new Map(
      parsed.data.answers.map((item) => [item.questionId, item.selectedAnswer.trim()])
    );

    const questions = await prisma.question.findMany({
      where: {
        id: { in: [...answerMap.keys()] },
      },
      select: {
        id: true,
        correctAnswer: true,
      },
    });

    if (questions.length === 0) {
      const response = NextResponse.json({ error: 'questions_not_found' }, { status: 404 });
      logger.logAPI(
        req,
        response,
        { className: 'QuickDiagnosticResultAPI', methodName: 'POST' },
        start
      );
      return response;
    }

    const score = questions.reduce((sum, question) => {
      const selected = answerMap.get(question.id);
      if (!question.correctAnswer || !selected) {
        return sum;
      }
      return question.correctAnswer.trim() === selected ? sum + 1 : sum;
    }, 0);

    const placement = scoreToPlacement(score);

    const student = await prisma.user.update({
      where: { id: studentId },
      data: {
        onboardingDiagnosticScore: score,
        onboardingPlacement: placement,
        onboardingDiagnosticCompletedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        onboardingDiagnosticScore: true,
        onboardingPlacement: true,
      },
    });

    // Send diagnostic summary email (best-effort -- never block the response).
    if (student.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://spinzyacademy.com';
      sendMailSafe({
        to: student.email,
        subject: 'Your Spinzy diagnostic is complete!',
        html: diagnosticSummaryEmailHtml({
          studentName: student.name ?? 'there',
          score,
          total: parsed.data.answers.length,
          placement,
          learningMapUrl: `${appUrl}/student/learning-map`,
        }),
      }).catch((err: unknown) =>
        logger.warn('diagnostic.result: summary email failed', { studentId, error: String(err) })
      );
    }

    logger.info('diagnostic.result.saved', { event: 'diagnostic_complete', context: { studentId, score, placement } });

    const response = NextResponse.json({
      ok: true,
      studentId: student.id,
      score,
      placement,
    });

    logger.logAPI(
      req,
      response,
      { className: 'QuickDiagnosticResultAPI', methodName: 'POST' },
      start
    );
    return response;
  } catch (error) {
    logger.error('quick.diagnostic.result_failed', { error: String(error), studentId });
    const response = NextResponse.json({ error: 'server_error' }, { status: 500 });
    logger.logAPI(
      req,
      response,
      { className: 'QuickDiagnosticResultAPI', methodName: 'POST' },
      start
    );
    return response;
  }
}
