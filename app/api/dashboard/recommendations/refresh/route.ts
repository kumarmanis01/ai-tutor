/**
 * FILE OBJECTIVE:
 * - API endpoint to trigger learning profile update after test/session completion.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/dashboard/recommendations/refresh/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | created refresh endpoint for learning profile
 */
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { updateLearningProfile } from '@/lib/recommendations/engine';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboard/recommendations/refresh
 * Triggers a refresh of the user's learning profile based on recent activity.
 * Call this after test completion, session end, or periodically.
 */
export async function POST() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await updateLearningProfile(userId);
    logger.info('recommendations.refresh', { userId });
    return NextResponse.json({ ok: true, message: 'Learning profile updated' });
  } catch (error) {
    logger.error('recommendations.refresh.error', {
      userId,
      error,
    });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}
