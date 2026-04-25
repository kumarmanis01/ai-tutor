/**
 * FILE OBJECTIVE:
 * - POST /api/v1/students/[studentId]/practice/submit
 * - Grades practice attempts, applies free-tier limits, updates topic progress, and awards XP for correct answers.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/studentId/practice/submit/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.3 practice submit endpoint
 * - 2026-04-25T00:30:00Z | copilot | included used counter in freemium response for client state consistency
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { awardXP } from '@/lib/student/xp';

export const dynamic = 'force-dynamic';

const DAILY_FREE_QUESTION_LIMIT = 5;

const submitSchema = z.object({
  topicId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().min(1),
      })
    )
    .min(1),
});

interface Params {
  params: Promise<{ studentId: string }>;
}

function istDateKey(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

function secondsUntilIstMidnight(now: Date = new Date()): number {
  const currentInIst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const endOfDayIst = new Date(currentInIst);
  endOfDayIst.setHours(23, 59, 59, 999);
  return Math.max(1, Math.ceil((endOfDayIst.getTime() - currentInIst.getTime()) / 1000));
}

async function getUsageCount(studentId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const key = `practice:daily:${studentId}:${istDateKey()}`;
    const raw = await redis.get(key);
    const parsed = Number.parseInt(raw ?? '0', 10);
    return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
  } catch {
    return 0;
  }
}

async function incrementUsage(studentId: string, by: number): Promise<void> {
  if (by <= 0) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = `practice:daily:${studentId}:${istDateKey()}`;
    const next = await redis.incrby(key, by);
    if (next === by) {
      await redis.expire(key, secondsUntilIstMidnight());
    }
  } catch {
    // Non-blocking: usage tracking should never fail the grading path.
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(req: Request, { params }: Params) {
  const start = Date.now();
  const { studentId } = await params;

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'PracticeSubmitV1API', methodName: 'POST' }, start);
      return res;
    }

    if (userId !== studentId) {
      const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      logger.logAPI(req, res, { className: 'PracticeSubmitV1API', methodName: 'POST' }, start);
      return res;
    }

    const parsed = submitSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const res = NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      logger.logAPI(req, res, { className: 'PracticeSubmitV1API', methodName: 'POST' }, start);
      return res;
    }

    const body = parsed.data;

    const [user, topic] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } }),
      prisma.topicDef.findUnique({ where: { id: body.topicId }, select: { id: true } }),
    ]);

    if (!topic) {
      const res = NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'PracticeSubmitV1API', methodName: 'POST' }, start);
      return res;
    }

    const isPremium = user?.subscriptionStatus !== 'free';
    if (!isPremium) {
      const used = await getUsageCount(userId);
      const remaining = Math.max(0, DAILY_FREE_QUESTION_LIMIT - used);
      if (remaining <= 0) {
        const res = NextResponse.json(
          {
            error: 'Daily free question limit reached',
            code: 'FREEMIUM_LIMIT_REACHED',
            remaining: 0,
            limit: DAILY_FREE_QUESTION_LIMIT,
          },
          { status: 429 }
        );
        logger.logAPI(req, res, { className: 'PracticeSubmitV1API', methodName: 'POST' }, start);
        return res;
      }

      if (body.answers.length > remaining) {
        const res = NextResponse.json(
          {
            error: 'Requested questions exceed remaining free allowance',
            code: 'FREEMIUM_LIMIT_REACHED',
            remaining,
            limit: DAILY_FREE_QUESTION_LIMIT,
          },
          { status: 429 }
        );
        logger.logAPI(req, res, { className: 'PracticeSubmitV1API', methodName: 'POST' }, start);
        return res;
      }
    }

    const ids = Array.from(new Set(body.answers.map((answer) => answer.questionId)));
    const questions = await prisma.question.findMany({
      where: {
        id: { in: ids },
        topicId: body.topicId,
      },
      select: {
        id: true,
        prompt: true,
        correctAnswer: true,
      },
    });
    const questionMap = new Map(questions.map((question) => [question.id, question]));

    const results = body.answers
      .map((answer) => {
        const question = questionMap.get(answer.questionId);
        if (!question || !question.correctAnswer) return null;
        const isCorrect = normalize(answer.answer) === normalize(question.correctAnswer);
        return {
          questionId: question.id,
          question: question.prompt,
          answer: answer.answer,
          isCorrect,
          correctAnswer: question.correctAnswer,
          hint: isCorrect
            ? null
            : 'No worries! Review the key concept from the lesson and try a similar example.',
          explanation: isCorrect
            ? 'Brilliant! You picked the correct answer.'
            : `The correct answer is ${question.correctAnswer}.`,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const totalAnswers = results.length;
    const correctAnswers = results.filter((result) => result.isCorrect).length;
    const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

    await Promise.all([
      updateStudentTopicProgress({
        studentId: userId,
        topicId: body.topicId,
        correctAnswers,
        totalAnswers,
        activityType: 'PRACTICE',
      }),
      awardXP({
        studentId: userId,
        amount: correctAnswers * 10,
        source: 'session_correct',
      }),
      isPremium ? Promise.resolve() : incrementUsage(userId, totalAnswers),
    ]);

    const usedAfter = isPremium ? 0 : await getUsageCount(userId);
    const remainingAfter = isPremium ? null : Math.max(0, DAILY_FREE_QUESTION_LIMIT - usedAfter);

    const res = NextResponse.json({
      topicId: body.topicId,
      score: `${correctAnswers}/${totalAnswers}`,
      accuracy,
      correctAnswers,
      totalAnswers,
      results,
      freemium: {
        isPremium,
        used: usedAfter,
        remaining: remainingAfter,
        limit: isPremium ? null : DAILY_FREE_QUESTION_LIMIT,
      },
    });

    logger.logAPI(req, res, { className: 'PracticeSubmitV1API', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('PracticeSubmitV1API.error', {
      event: 'practice_submit_failed',
      context: { error: err instanceof Error ? err.message : String(err), studentId },
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'PracticeSubmitV1API', methodName: 'POST' }, start);
    return res;
  }
}
