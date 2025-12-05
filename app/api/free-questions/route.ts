import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { isPremiumUser } from '@/lib/subscription';
import { logApiUsage } from '@/utils/logApiUsage';

const DAILY_FREE_LIMIT = Number(process.env.NEXT_PUBLIC_DAILY_FREE_LIMIT ?? 3);

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

    // Read user's current remaining count; no automatic reset is performed here.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    return NextResponse.json({
      remaining: user.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT,
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
    const session = await getServerSessionForHandlers();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const userId = (session.user as SessionUser)?.id;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const premium = await isPremiumUser(userId);
    if (premium) {
      // Premium users don't consume the free quota
      return NextResponse.json({ remaining: null, isPremium: true, total: DAILY_FREE_LIMIT });
    }

    // Atomic decrement of user's remaining free questions
    const result = await prisma.$transaction(async (tx) => {
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
