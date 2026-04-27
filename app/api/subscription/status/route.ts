export const dynamic = 'force-dynamic'

import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { SessionUser } from '@/lib/types';
import { isPremiumUser } from '@/lib/subscription';
import { logApiUsage } from '@/utils/logApiUsage';

export async function GET() {
  logApiUsage('/api/subscription/status', 'GET');

  try {
    const session = await getServerSessionForHandlers();
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

    logger.add(`Subscription status: userId=${userId}, isPremium=${String(isPremium)}`, { className: 'subscription', methodName: 'status' });

    return NextResponse.json({
      authenticated: true,
      isPremium,
      // todaysCount,
    });
  } catch (err) {
    logger.error('subscription status error', { className: 'api.subscription.status', methodName: 'GET', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
