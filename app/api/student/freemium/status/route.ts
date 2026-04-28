import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { checkFreeTierCap } from '@/lib/freemium';

export const dynamic = 'force-dynamic';

/**
 * GET /api/student/freemium/status
 *
 * AC-02 (F-STU-040): Returns the current free-tier session cap status for the
 * authenticated student. Used by EndOfSessionCard to decide whether to show
 * the upgrade nudge after the last free session completes.
 *
 * Response: { allowed, sessionsUsed, sessionsRemaining, periodStart }
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  try {
    const session = await getServerSessionForHandlers();
    const userId = (session as any)?.user?.id as string | undefined;

    if (!userId) {
      res = NextResponse.json({ error: 'Unauthorized', code: 'LOGIN_REQUIRED' }, { status: 401 });
      logger.logAPI(req, res, { className: 'FreemiumStatusAPI', methodName: 'GET' }, start);
      return res;
    }

    const status = await checkFreeTierCap(userId);

    res = NextResponse.json({
      allowed: status.allowed,
      sessionsUsed: status.sessionsUsed,
      sessionsRemaining: status.sessionsRemaining,
      periodStart: status.periodStart.toISOString(),
    });
    logger.logAPI(req, res, { className: 'FreemiumStatusAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('FreemiumStatusAPI.error', {
      event: 'freemium_status_error',
      context: { error: err instanceof Error ? err.message : String(err) },
    });
    res = NextResponse.json(
      { error: 'Failed to load freemium status', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
    logger.logAPI(req, res, { className: 'FreemiumStatusAPI', methodName: 'GET' }, start);
    return res;
  }
}
