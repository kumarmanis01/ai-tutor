import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getHistoryForEntity } from '@/lib/admin/contentQualityMonitoring';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: 'Missing entityType or entityId' },
      { status: 400 }
    );
  }

  const history = await getHistoryForEntity(entityType, entityId);
  return NextResponse.json({ history });
}
