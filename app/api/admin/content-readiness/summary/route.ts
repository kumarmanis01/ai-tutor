import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getReadinessSummary, getGenerationPaused } from '@/lib/admin/contentReadiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [summary, generationPaused] = await Promise.all([
    getReadinessSummary(),
    getGenerationPaused(),
  ]);
  return NextResponse.json({ ...summary, generationPaused });
}
