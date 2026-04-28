/**
 * FILE OBJECTIVE:
 * - GET /api/v1/students/[studentId]/freemium/limits
 * - Returns feature limits and remaining quota for student freemium walls.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/studentId/freemium/limits/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.4 freemium limits endpoint
 * - 2026-04-25T01:25:00Z | copilot | exposed upgrade-request cooldown state for modal persistence across restarts
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const PRACTICE_DAILY_LIMIT = 5;
const AI_TUTOR_DAILY_LIMIT = 3;
const CHAPTER_QUIZ_DAILY_LIMIT = 0;

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

async function getPracticeUsed(studentId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const raw = await redis.get(`practice:daily:${studentId}:${istDateKey()}`);
    const parsed = Number.parseInt(raw ?? '0', 10);
    return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
  } catch {
    return 0;
  }
}

async function getCooldownState(
  studentId: string,
  featureType: 'practice' | 'ai_tutor' | 'chapter_quiz'
): Promise<{ active: boolean; retryAfterSeconds: number }> {
  const redis = getRedis();
  if (!redis) return { active: false, retryAfterSeconds: 0 };
  try {
    const key = `freemium:upgrade-request:${studentId}:${featureType}`;
    const raw = await redis.get(key);
    if (!raw) return { active: false, retryAfterSeconds: 0 };
    const ttl = await redis.ttl(key);
    return { active: ttl > 0, retryAfterSeconds: Math.max(0, ttl) };
  } catch {
    return { active: false, retryAfterSeconds: 0 };
  }
}

export async function GET(req: Request, { params }: Params) {
  const start = Date.now();
  const { studentId } = await params;

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'FreemiumLimitsV1API', methodName: 'GET' }, start);
      return res;
    }

    if (userId !== studentId) {
      const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      logger.logAPI(req, res, { className: 'FreemiumLimitsV1API', methodName: 'GET' }, start);
      return res;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    });

    const isPremium = user?.subscriptionStatus !== 'free';
    const [practiceUsed, practiceCooldown, aiTutorCooldown, chapterQuizCooldown] = await Promise.all([
      isPremium ? Promise.resolve(0) : getPracticeUsed(userId),
      getCooldownState(userId, 'practice'),
      getCooldownState(userId, 'ai_tutor'),
      getCooldownState(userId, 'chapter_quiz'),
    ]);

    const res = NextResponse.json({
      isPremium,
      limits: {
        practice: {
          limit: isPremium ? null : PRACTICE_DAILY_LIMIT,
          used: isPremium ? 0 : practiceUsed,
          remaining: isPremium ? null : Math.max(0, PRACTICE_DAILY_LIMIT - practiceUsed),
          cooldown: practiceCooldown,
        },
        aiTutor: {
          limit: isPremium ? null : AI_TUTOR_DAILY_LIMIT,
          used: 0,
          remaining: isPremium ? null : AI_TUTOR_DAILY_LIMIT,
          cooldown: aiTutorCooldown,
        },
        chapterQuiz: {
          limit: isPremium ? null : CHAPTER_QUIZ_DAILY_LIMIT,
          used: 0,
          remaining: isPremium ? null : CHAPTER_QUIZ_DAILY_LIMIT,
          cooldown: chapterQuizCooldown,
        },
      },
    });

    logger.logAPI(req, res, { className: 'FreemiumLimitsV1API', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('FreemiumLimitsV1API.error', {
      event: 'freemium_limits_failed',
      context: { error: err instanceof Error ? err.message : String(err), studentId },
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'FreemiumLimitsV1API', methodName: 'GET' }, start);
    return res;
  }
}
