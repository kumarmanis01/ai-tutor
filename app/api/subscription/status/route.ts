import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// import { prisma } from '@/lib/db';
import { SessionUser } from '@/lib/types';
import { isPremiumUser } from '@/lib/subscription';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  logApiUsage('/api/subscription/status', 'GET');

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const sessionUser = session.user as SessionUser;

    if (!sessionUser || !sessionUser.id) {
      return NextResponse.json({
        authenticated: false,
        isPremium: false,
        todaysCount: 0,
      });
    }

    const userId = sessionUser.id;

    // Use the central utility for premium check
    const isPremium = await isPremiumUser(userId);

    // // Count today's questions
    // const todaysCount = await getTodaysQuestionCount(userId);

    console.log('Subscription status:', {
      userId,
      isPremium,
      // todaysCount,
    });

    return NextResponse.json({
      authenticated: true,
      isPremium,
      // todaysCount,
    });
  } catch (err) {
    console.error('subscription status error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
