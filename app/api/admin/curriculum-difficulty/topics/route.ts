import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getTopicDifficultyList } from '@/lib/admin/curriculumDifficultyIntelligence';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const subjectId = searchParams.get('subjectId') ?? undefined;
  const limitParam = searchParams.get('limit');

  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const result = await getTopicDifficultyList({ from, to, subjectId, limit });
  return NextResponse.json(result);
}

