/**
 * FILE OBJECTIVE:
 * - Expose free-question quota read and consume endpoints for authenticated students.
 * - Delegate quota mutation logic to shared server-side quota service for consistency across ask APIs.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/free-questions/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | refactor POST handler to use shared free-question quota consume service
 */

import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { isPremiumUser } from '@/lib/subscription';
import { checkFreeTierCap } from '@/lib/freemium';
import { logApiUsage } from '@/utils/logApiUsage';
import { DAILY_FREE_QUESTION_LIMIT } from '@/lib/constants/freeTier';
import { consumeDailyFreeQuestionQuota } from '@/lib/freeQuestionQuota';

function isMissingFreeQuestionColumnError(error: unknown): boolean {
  const err = error as { code?: string; message?: unknown };
  const message = String(err?.message ?? '');
  return err?.code === 'P2022' && message.includes('todaysFreeQuestionsCount');
}

// NOTE: `lastFreeQuestionsUpdate` column was removed from the schema.
// The application no longer performs lazy UTC resets based on that timestamp.
// We preserve the simple quota behavior: `todaysFreeQuestionsCount` is used
// as the authoritative remaining count. If you need daily resets, implement
// a separate scheduled job or a different mechanism.

/**
 * GET: return remaining free questions for the authenticated user
 * POST: decrement remaining free questions (atomic check) when user asks a question
 */
export async function GET() {
  logApiUsage('/api/free-questions', 'GET');
  try {
    const session = await getServerSessionForHandlers();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const userId = (session.user as SessionUser)?.id;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const premium = await isPremiumUser(userId);
    if (premium) {
      return NextResponse.json({ remaining: null, isPremium: true, total: DAILY_FREE_QUESTION_LIMIT });
    }

    try {
      // Read user's current remaining count; no automatic reset is performed here.
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

      return NextResponse.json({
        remaining: user.todaysFreeQuestionsCount ?? DAILY_FREE_QUESTION_LIMIT,
        isPremium: false,
        total: DAILY_FREE_QUESTION_LIMIT,
      });
    } catch (error) {
      if (!isMissingFreeQuestionColumnError(error)) throw error;

      const status = await checkFreeTierCap(userId);
      return NextResponse.json({
        remaining: status.sessionsRemaining,
        isPremium: false,
        total: DAILY_FREE_QUESTION_LIMIT,
      });
    }
  } catch (err) {
    logger.error('free-questions GET error', { className: 'api.free-questions', methodName: 'GET', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    let res: Response;
    if (!session) {
      res = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
      return res;
    }

    const userId = (session.user as SessionUser)?.id;
    if (!userId) {
      res = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
      return res;
    }

    const result = await consumeDailyFreeQuestionQuota(userId);

    if (result.status === 'not_found') {
      res = NextResponse.json({ error: 'not_found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
      return res;
    }

    if (result.status === 'limit_reached') {
      res = NextResponse.json({ error: 'free_limit_reached' }, { status: 403 });
      logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
      return res;
    }

    res = NextResponse.json({
      remaining: result.remaining,
      isPremium: result.isPremium,
      total: DAILY_FREE_QUESTION_LIMIT,
    });
    logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('free-questions POST error', { className: 'api.free-questions', methodName: 'POST', error: err });
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
    return res;
  }
}
