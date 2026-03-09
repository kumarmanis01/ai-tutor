import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getStudentRiskList } from '@/lib/admin/studentRiskDetection';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;
  const board = searchParams.get('board') ?? undefined;
  const grade = searchParams.get('grade') ?? undefined;
  const category = (searchParams.get('category') as any) ?? undefined;
  const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!, 10) : undefined;

  const { students, total } = await getStudentRiskList({ limit, offset, board, grade, category, minScore });
  return NextResponse.json({ students, total });
}

