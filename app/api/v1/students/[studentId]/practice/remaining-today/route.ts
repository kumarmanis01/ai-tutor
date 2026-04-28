/**
 * FILE OBJECTIVE:
 * - GET /api/v1/students/[studentId]/practice/remaining-today
 * - Returns free-tier daily remaining question count for S2.3.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/students/studentId/practice/remaining-today/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.3 remaining-today endpoint using Redis-backed daily counter
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const DAILY_FREE_QUESTION_LIMIT = 5;

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

async function getDailyUsage(studentId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const key = `practice:daily:${studentId}:${istDateKey()}`;
    const raw = await redis.get(key);
    const value = Number.parseInt(raw ?? '0', 10);
    return Number.isNaN(value) ? 0 : Math.max(0, value);
  } catch {
    return 0;
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
      logger.logAPI(req, res, { className: 'PracticeRemainingAPI', methodName: 'GET' }, start);
      return res;
    }

    if (userId !== studentId) {
      const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      logger.logAPI(req, res, { className: 'PracticeRemainingAPI', methodName: 'GET' }, start);
      return res;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    });

    const isPremium = user?.subscriptionStatus !== 'free';

    if (isPremium) {
      const res = NextResponse.json({
        isPremium: true,
        limit: null,
        used: 0,
        remaining: null,
      });
      logger.logAPI(req, res, { className: 'PracticeRemainingAPI', methodName: 'GET' }, start);
      return res;
    }

    const used = await getDailyUsage(userId);
    const remaining = Math.max(0, DAILY_FREE_QUESTION_LIMIT - used);

    const res = NextResponse.json({
      isPremium: false,
      limit: DAILY_FREE_QUESTION_LIMIT,
      used,
      remaining,
    });

    logger.logAPI(req, res, { className: 'PracticeRemainingAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('PracticeRemainingAPI.error', {
      event: 'practice_remaining_failed',
      context: { error: err instanceof Error ? err.message : String(err), studentId },
    });
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    logger.logAPI(req, res, { className: 'PracticeRemainingAPI', methodName: 'GET' }, start);
    return res;
  }
}
