/**
 * FILE OBJECTIVE:
 * - Persist S1.3 quick onboarding diagnostic outcomes (score + placement) on student profile.
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
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

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
  params: Promise<{ id: string }>;
}

function scoreToPlacement(score: number): PlacementLevel {
  if (score >= 4) return 'ADVANCED';
  if (score >= 2) return 'STANDARD';
  return 'FOUNDATION';
}

export async function POST(req: Request, context: RouteContext) {
  const start = Date.now();
  const { id } = await context.params;

  if (!id) {
    const response = NextResponse.json({ error: 'missing_student_id' }, { status: 400 });
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
      where: { id },
      data: {
        onboardingDiagnosticScore: score,
        onboardingPlacement: placement,
        onboardingDiagnosticCompletedAt: new Date(),
      },
      select: {
        id: true,
        onboardingDiagnosticScore: true,
        onboardingPlacement: true,
      },
    });

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
    logger.error('quick.diagnostic.result_failed', { error: String(error), studentId: id });
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
