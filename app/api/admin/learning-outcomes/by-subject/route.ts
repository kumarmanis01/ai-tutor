import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getLearningOutcomesBySubject } from '@/lib/admin/learningOutcomeAnalytics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const board = searchParams.get('board') ?? undefined;
  const grade = searchParams.get('grade') ?? undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

  const subjects = await getLearningOutcomesBySubject({ board, grade, limit });
  return NextResponse.json({ subjects });
}
