import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getReadinessList } from '@/lib/admin/contentReadiness';

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
  const status = searchParams.get('status') ?? undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

  const { items, total } = await getReadinessList({
    board,
    grade,
    subjectId,
    status,
    limit,
    offset,
  });
  return NextResponse.json({ items, total });
}
