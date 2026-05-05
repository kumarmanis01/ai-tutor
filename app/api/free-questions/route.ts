import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { isPremiumUser } from '@/lib/subscription';
import { checkFreeTierCap, incrementFreeTierUsage } from '@/lib/freemium';
import { logApiUsage } from '@/utils/logApiUsage';

const DAILY_FREE_LIMIT = Number(process.env.NEXT_PUBLIC_DAILY_FREE_LIMIT ?? 3);

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
      return NextResponse.json({ remaining: null, isPremium: true, total: DAILY_FREE_LIMIT });
    }

    try {
      // Read user's current remaining count; no automatic reset is performed here.
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

      return NextResponse.json({
        remaining: user.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT,
        isPremium: false,
        total: DAILY_FREE_LIMIT,
      });
    } catch (error) {
      if (!isMissingFreeQuestionColumnError(error)) throw error;

      const status = await checkFreeTierCap(userId);
      return NextResponse.json({
        remaining: status.sessionsRemaining,
        isPremium: false,
        total: DAILY_FREE_LIMIT,
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

    const premium = await isPremiumUser(userId);
    if (premium) {
      res = NextResponse.json({ remaining: null, isPremium: true, total: DAILY_FREE_LIMIT });
      logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
      return res;
    }

    // Atomic decrement of user's remaining free questions.
    let result: { notFound: true } | { limitReached: true } | { updated: { todaysFreeQuestionsCount: number | null } };
    try {
      result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) return { notFound: true } as const;

        if ((user.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT) <= 0) {
          return { limitReached: true } as const;
        }

        const updated = await tx.user.update({
          where: { id: userId },
          data: { todaysFreeQuestionsCount: { decrement: 1 } },
        });

        return { updated } as const;
      });
    } catch (error) {
      if (!isMissingFreeQuestionColumnError(error)) throw error;

      const status = await checkFreeTierCap(userId);
      if (!status.allowed) {
        res = NextResponse.json({ error: 'free_limit_reached' }, { status: 403 });
        logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
        return res;
      }

      await incrementFreeTierUsage(userId);
      const remaining = Math.max(0, status.sessionsRemaining - 1);
      res = NextResponse.json({ remaining, total: DAILY_FREE_LIMIT });
      logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
      return res;
    }

    if ('notFound' in result) {
      res = NextResponse.json({ error: 'not_found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
      return res;
    }
    if ('limitReached' in result) {
      res = NextResponse.json({ error: 'free_limit_reached' }, { status: 403 });
      logger.logAPI(req, res, { className: 'FreeQuestionsAPI', methodName: 'POST' }, start);
      return res;
    }

    res = NextResponse.json({
      remaining: result.updated.todaysFreeQuestionsCount,
      total: DAILY_FREE_LIMIT,
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
