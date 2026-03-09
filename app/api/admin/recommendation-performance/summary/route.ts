import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRecommendationPerformanceSummary } from '@/lib/admin/recommendationPerformanceAnalytics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const attributionWindowMinutesParam = searchParams.get('attributionWindowMinutes');

  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const attributionWindowMinutes = attributionWindowMinutesParam
    ? parseInt(attributionWindowMinutesParam, 10)
    : undefined;

  const summary = await getRecommendationPerformanceSummary({
    from,
    to,
    attributionWindowMinutes,
  });
  return NextResponse.json(summary);
}

