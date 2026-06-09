/**
 * FILE OBJECTIVE:
 * - GET /api/credits/status: returns the authenticated student's daily AI credit
 *   usage, limit, remaining balance, and subscription plan tier.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/credits.status.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for task S1-3
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getDailyUsage, getDailyLimit } from '@/lib/credits/dailyCredits';
import { isPremiumUser } from '@/lib/subscription';
import { logger } from '@/lib/logger';

export async function GET(): Promise<Response> {
  // Auth guard -- session check before any DB query
  let sessionUserId: string;
  try {
    const session = await getServerSessionForHandlers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- session shape is untyped from next-auth
    if (!session || !(session as any)?.user?.id) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Authentication required.' }, { status: 401 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- session shape is untyped from next-auth
    sessionUserId = (session as any).user.id as string;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('credits.status.session.failed', { error: message });
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Authentication required.' }, { status: 401 });
  }

  let used = 0;
  let limit = 50;
  let isPaid = false;

  try {
    [used, limit, isPaid] = await Promise.all([
      getDailyUsage(sessionUserId),
      getDailyLimit(sessionUserId),
      isPremiumUser(sessionUserId),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('credits.status.fetch.failed', { userId: sessionUserId, error: message });
    // Return safe fallback values -- never block the client on a Redis/DB error
  }

  const plan = isPaid ? 'paid' : 'free';
  const balance = Math.max(0, limit - used);

  return NextResponse.json({ used, limit, balance, plan });
}
