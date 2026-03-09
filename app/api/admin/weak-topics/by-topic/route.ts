import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getWeakTopicsByTopic } from '@/lib/admin/weakTopicMonitoring';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const board = searchParams.get('board') ?? undefined;
  const grade = searchParams.get('grade') ?? undefined;
  const subjectId = searchParams.get('subjectId') ?? undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 500) : undefined;

  const topics = await getWeakTopicsByTopic({ board, grade, subjectId, limit });
  return NextResponse.json({ topics });
}
