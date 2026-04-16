import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import ensureMinimumMocks from '@/lib/mock/ensureMocks';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/mock/ensure
 * Admin-only endpoint to ensure a minimum number of MockExam records exist per subject/grade/board.
 */
export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role || 'user';
  if (role !== 'admin') {
    const res = NextResponse.json({ error: 'forbidden' }, { status: 403 });
    logger.logAPI(req, res, { className: 'AdminMockEnsure', methodName: 'POST' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const minPer = Number(body.minPer ?? 5);
  const dryRun = !!body.dryRun;

  try {
    const result = await ensureMinimumMocks({ minPer, dryRun });
    const res = NextResponse.json(result);
    logger.logAPI(req, res, { className: 'AdminMockEnsure', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    const res = NextResponse.json({ error: 'failed', message: String(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'AdminMockEnsure', methodName: 'POST' }, start);
    return res;
  }
}
