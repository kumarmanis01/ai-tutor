import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { isPremiumUser } from '@/lib/subscription';
import { logApiUsage } from '@/utils/logApiUsage';

const DAILY_FREE_LIMIT = Number(process.env.NEXT_PUBLIC_DAILY_FREE_LIMIT ?? 3);

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function resetIfStale(userId: string) {
  const start = startOfTodayUTC();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (!user.lastFreeQuestionsUpdate || user.lastFreeQuestionsUpdate < start) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { todaysFreeQuestionsCount: DAILY_FREE_LIMIT, lastFreeQuestionsUpdate: new Date() },
    });
    // Log that we performed a lazy reset for this user
    try {
      await logApiUsage('/api/free-questions', 'RESET');
    } catch (e) {
      console.error('Failed to log free-questions reset', e);
    }
    return updated;
  }

  return user;
}

/**
 * GET: return remaining free questions for the authenticated user
 * POST: decrement remaining free questions (atomic check) when user asks a question
 */
export async function GET() {
  logApiUsage('/api/free-questions', 'GET');
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const userId = (session.user as SessionUser)?.id;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const premium = await isPremiumUser(userId);
    if (premium) {
      return NextResponse.json({ remaining: null, isPremium: true, total: DAILY_FREE_LIMIT });
    }

    // lazy reset: if user's last update was before today's UTC start, reset their counter
    const maybeUser = await resetIfStale(userId);
    if (!maybeUser) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    return NextResponse.json({
      remaining: maybeUser.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT,
      isPremium: false,
      total: DAILY_FREE_LIMIT,
    });
  } catch (err) {
    console.error('free-questions GET error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST() {
  logApiUsage('/api/free-questions', 'POST');
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const userId = (session.user as SessionUser)?.id;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const premium = await isPremiumUser(userId);
    if (premium) {
      // Premium users don't consume the free quota
      return NextResponse.json({ remaining: null, isPremium: true, total: DAILY_FREE_LIMIT });
    }

    // lazy reset + atomic decrement using a transaction
    const start = startOfTodayUTC();

    let resetPerformed = false;
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return { notFound: true } as const;

      // reset if stale
      if (!user.lastFreeQuestionsUpdate || user.lastFreeQuestionsUpdate < start) {
        await tx.user.update({
          where: { id: userId },
          data: { todaysFreeQuestionsCount: DAILY_FREE_LIMIT, lastFreeQuestionsUpdate: new Date() },
        });
        resetPerformed = true;
        user.todaysFreeQuestionsCount = DAILY_FREE_LIMIT;
      }

      if ((user.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT) <= 0) {
        return { limitReached: true } as const;
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { todaysFreeQuestionsCount: { decrement: 1 }, lastFreeQuestionsUpdate: new Date() },
      });

      return { updated } as const;
    });

    // If we reset inside the POST transaction, log the reset for metrics
    if (resetPerformed) {
      try {
        await logApiUsage('/api/free-questions', 'RESET');
      } catch (e) {
        console.error('Failed to log free-questions reset (POST)', e);
      }
    }

    if ('notFound' in result) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if ('limitReached' in result)
      return NextResponse.json({ error: 'free_limit_reached' }, { status: 403 });

    return NextResponse.json({
      remaining: result.updated.todaysFreeQuestionsCount,
      total: DAILY_FREE_LIMIT,
    });
  } catch (err) {
    console.error('free-questions POST error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
