/**
 * FILE OBJECTIVE:
 * - Exposes the deterministic Home Tutor Engine via a single GET endpoint.
 * - Use this for: dashboard hero, notes hero, practice hero.
 * - Do NOT use this for content discovery or recommendation browsing.
 *   For those, continue using /api/dashboard/recommendations.
 *
 * Returns:
 *   { topicId, subject, chapter, ruleId, reasonLabel, actionType,
 *     masteryLevel?, accuracy?, sessionId?, estimatedTimeMin? }
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per architectural spec
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ action: null }, { status: 401 });
  }

  try {
    const result = await getNextAction(userId);
    const action = result && typeof result === 'object' && 'action' in result ? result.action : (result as any);
    const traceId = result && typeof result === 'object' && 'traceId' in result ? (result as any).traceId : undefined;
    return NextResponse.json(traceId ? { action, traceId } : { action });
  } catch (error) {
    logger.error('home.next-action.error', { userId, error });
    // Fail-safe: return null action rather than 500
    return NextResponse.json({ action: null });
  }
}
