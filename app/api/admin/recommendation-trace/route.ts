/**
 * GET /api/admin/recommendation-trace?studentId=xxx
 *
 * Returns the next-action engine trace for a student: rules evaluated,
 * matched rule, final decision, and latency. Used for observability and
 * debugging. Requires admin auth.
 *
 * When ENABLE_REC_TRACE=1 (or unset, admin-only), the endpoint calls
 * getNextAction with returnTrace: true and returns the trace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextAction } from '@/lib/homeEngine/getNextAction';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = req.nextUrl.searchParams.get('studentId');
  if (!studentId) {
    return NextResponse.json(
      { error: 'Missing studentId query parameter' },
      { status: 400 },
    );
  }

  try {
    const result = await getNextAction(studentId, { returnTrace: true });
    const withTrace =
      result &&
      typeof result === 'object' &&
      'action' in result &&
      'trace' in result
        ? (result as { action: unknown; traceId: string; trace: unknown })
        : null;

    if (!withTrace || !withTrace.trace) {
      return NextResponse.json({
        action: result && typeof result === 'object' && 'action' in result
          ? (result as { action: unknown }).action
          : result,
        trace: null,
        message: 'Trace not available (engine may have returned without returnTrace).',
      });
    }

    return NextResponse.json({
      action: withTrace.action,
      traceId: withTrace.traceId,
      trace: withTrace.trace,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to compute recommendation trace',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
