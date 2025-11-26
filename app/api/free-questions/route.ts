import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import { isPremiumUser } from '@/lib/subscription';
import { logApiUsage } from '@/utils/logApiUsage';

const DAILY_FREE_LIMIT = Number(process.env.NEXT_PUBLIC_DAILY_FREE_LIMIT ?? 3);

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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const premium = await isPremiumUser(userId);
    if (premium) {
      return NextResponse.json({ remaining: null, isPremium: true, total: DAILY_FREE_LIMIT });
    }

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
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const userId = (session.user as SessionUser)?.id;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const premium = await isPremiumUser(userId);
    if (premium) {
      // Premium users don't consume the free quota
      return NextResponse.json({ remaining: null, isPremium: true, total: DAILY_FREE_LIMIT });
    }

    // Atomically check and decrement the user's remaining free questions
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    if ((user.todaysFreeQuestionsCount ?? DAILY_FREE_LIMIT) <= 0) {
      return NextResponse.json({ error: 'free_limit_reached' }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { todaysFreeQuestionsCount: { decrement: 1 } },
    });

    return NextResponse.json({
      remaining: updated.todaysFreeQuestionsCount,
      total: DAILY_FREE_LIMIT,
    });
  } catch (err) {
    console.error('free-questions POST error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
